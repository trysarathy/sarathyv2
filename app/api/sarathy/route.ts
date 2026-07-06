import { NextRequest, NextResponse } from 'next/server'
import { createChatCompletionWithRetry } from '@/lib/groq'
import { buildCompanionContext } from '@/lib/sarathy/context'
import {
  loadConversationSummary,
  loadRecentMessages,
  maybeRefreshConversationSummary,
  saveChatExchange,
} from '@/lib/sarathy/conversation-memory'
import { buildSystemPrompt } from '@/lib/sarathy/prompts'
import { getAuthenticatedUser } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { message, isAnxious } = await req.json()
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const trimmedMessage = message.trim()

    const [ctx, recentMessages, summaryRow] = await Promise.all([
      buildCompanionContext(user.id),
      loadRecentMessages(user.id),
      loadConversationSummary(user.id),
    ])

    const systemPrompt = buildSystemPrompt(ctx, {
      isAnxious: Boolean(isAnxious),
      conversationSummary: summaryRow?.summary ?? null,
    })

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...recentMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: trimmedMessage },
    ]

    const completion = await createChatCompletionWithRetry({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 300,
      messages,
    })

    const reply =
      completion.choices[0]?.message?.content ||
      "I'm here — try again in a moment 🌸"

    await saveChatExchange(user.id, trimmedMessage, reply)

    const recentAfterSave = await loadRecentMessages(user.id)
    await maybeRefreshConversationSummary(user.id, recentAfterSave)

    return NextResponse.json({ message: reply })
  } catch (error) {
    console.error('Sarathy API error:', error)
    return NextResponse.json(
      {
        message:
          "I'm having trouble connecting right now — but I'm here. Try again in a moment 🌸",
      },
      { status: 500 }
    )
  }
}
