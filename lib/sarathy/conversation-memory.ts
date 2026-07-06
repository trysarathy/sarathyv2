import { getGroqClient } from '@/lib/groq'
import { createServiceSupabaseClient } from '@/lib/supabase-admin'

const RECENT_MESSAGE_LIMIT = 20
const SUMMARY_REFRESH_INTERVAL = 10
const SUMMARY_STALE_MS = 7 * 24 * 60 * 60 * 1000
const SUMMARY_INPUT_LIMIT = 50

export interface ChatRow {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface ConversationSummaryRow {
  summary: string
  summarized_through: string | null
  message_count: number
  updated_at: string
}

export async function loadRecentMessages(userId: string): Promise<ChatRow[]> {
  const supabase = createServiceSupabaseClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(RECENT_MESSAGE_LIMIT)

  if (error) throw error
  return ((data ?? []) as ChatRow[]).reverse()
}

export async function loadConversationSummary(
  userId: string
): Promise<ConversationSummaryRow | null> {
  const supabase = createServiceSupabaseClient()
  const { data } = await supabase
    .from('conversation_summaries')
    .select('summary, summarized_through, message_count, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  return (data as ConversationSummaryRow | null) ?? null
}

export async function getTotalMessageCount(userId: string): Promise<number> {
  const supabase = createServiceSupabaseClient()
  const { count, error } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) throw error
  return count ?? 0
}

export async function saveChatExchange(
  userId: string,
  userContent: string,
  assistantContent: string
): Promise<void> {
  const supabase = createServiceSupabaseClient()
  const { error } = await supabase.from('chat_messages').insert([
    { user_id: userId, role: 'user', content: userContent },
    { user_id: userId, role: 'assistant', content: assistantContent },
  ])

  if (error) throw error
}

function shouldRefreshSummary(
  totalCount: number,
  summary: ConversationSummaryRow | null
): boolean {
  if (totalCount <= RECENT_MESSAGE_LIMIT) return false
  if (!summary?.summary) return true

  const messagesSince = totalCount - summary.message_count
  if (messagesSince >= SUMMARY_REFRESH_INTERVAL) return true

  const age = Date.now() - new Date(summary.updated_at).getTime()
  return age > SUMMARY_STALE_MS
}

async function loadOlderMessages(
  userId: string,
  beforeCreatedAt: string
): Promise<ChatRow[]> {
  const supabase = createServiceSupabaseClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('user_id', userId)
    .lt('created_at', beforeCreatedAt)
    .order('created_at', { ascending: false })
    .limit(SUMMARY_INPUT_LIMIT)

  if (error) throw error
  return ((data ?? []) as ChatRow[]).reverse()
}

async function generateSummary(
  olderMessages: ChatRow[],
  existingSummary: string | null
): Promise<string> {
  const groq = getGroqClient()
  const transcript = olderMessages
    .map((m) => `${m.role === 'user' ? 'User' : 'Sarathy'}: ${m.content}`)
    .join('\n')

  const prior = existingSummary?.trim()
    ? `Existing summary to update:\n${existingSummary.trim()}\n\nNew older messages:\n`
    : ''

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    max_tokens: 150,
    messages: [
      {
        role: 'system',
        content:
          'Summarize this user\'s past money conversations in 3–5 short bullet points. Focus on goals, fears, recurring topics, and decisions they made. Be factual and concise. No preamble.',
      },
      {
        role: 'user',
        content: `${prior}${transcript}`,
      },
    ],
  })

  return (
    completion.choices[0]?.message?.content?.trim() ||
    existingSummary?.trim() ||
    ''
  )
}

export async function maybeRefreshConversationSummary(
  userId: string,
  recentMessages: ChatRow[]
): Promise<void> {
  const totalCount = await getTotalMessageCount(userId)
  const existing = await loadConversationSummary(userId)

  if (!shouldRefreshSummary(totalCount, existing)) return
  if (recentMessages.length === 0) return

  const oldestRecent = recentMessages[0]
  const olderMessages = await loadOlderMessages(userId, oldestRecent.created_at)
  if (olderMessages.length === 0) return

  const summary = await generateSummary(olderMessages, existing?.summary ?? null)
  const summarizedThrough = olderMessages[olderMessages.length - 1].created_at

  const supabase = createServiceSupabaseClient()
  const { error } = await supabase.from('conversation_summaries').upsert(
    {
      user_id: userId,
      summary,
      summarized_through: summarizedThrough,
      message_count: totalCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    console.error('Failed to upsert conversation summary:', error)
  }
}
