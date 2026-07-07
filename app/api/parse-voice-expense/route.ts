import { NextRequest, NextResponse } from 'next/server'
import { getGroqClient } from '@/lib/groq'
import { EXPENSE_CATEGORIES, normalizeExpenseCategory } from '@/lib/expense/categories'
import { getAuthenticatedUser } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { transcript, currency = 'SGD' } = await req.json()
    const text = typeof transcript === 'string' ? transcript.trim() : ''
    if (!text) {
      return NextResponse.json({ error: 'No transcript' }, { status: 400 })
    }

    const categories = EXPENSE_CATEGORIES.join(', ')
    const completion = await getGroqClient().chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 200,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: `Extract an expense from this spoken phrase. Currency context: ${currency}.
Categories (pick exactly one): ${categories}

Phrase: "${text}"

Return ONLY valid JSON with no markdown:
{"amount": number or null, "category": "one of the categories", "description": "short merchant or purpose string"}

Rules:
- amount must be a positive number if clearly stated (handle "twelve fifty" as 12.50, "twenty bucks" as 20)
- if amount is unclear, use null
- description should be concise (e.g. "Grab ride", "Koufu lunch")
- category must match the list exactly`,
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned) as {
      amount?: number | null
      category?: string
      description?: string
    }

    const amount =
      typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : null
    if (amount == null) {
      return NextResponse.json({ error: 'Could not extract amount' }, { status: 422 })
    }

    return NextResponse.json({
      amount,
      category: normalizeExpenseCategory(parsed.category),
      description: typeof parsed.description === 'string' ? parsed.description.trim() : '',
    })
  } catch (error) {
    console.error('parse-voice-expense error:', error)
    return NextResponse.json({ error: 'Parse failed' }, { status: 500 })
  }
}
