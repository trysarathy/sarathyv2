import { NextRequest, NextResponse } from 'next/server'
import { getGroqClient } from '@/lib/groq'
import {
  EXPENSE_CATEGORIES,
  normalizeExpenseCategory,
  normalizeExpenseSubcategory,
} from '@/lib/expense/categories'
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

    const categories = EXPENSE_CATEGORIES.join('/')
    const completion = await getGroqClient().chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 250,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: `Extract expense details from this voice input: '${text}'

Currency context: ${currency} (spoken amounts may be in this currency or another — still return a numeric amount).

Return JSON only:
{
  "amount": number,
  "description": string,
  "category": string (Food/Transport/Shopping/Home/Health/Social/Education/Family/Entertainment/Other),
  "subcategory": string or null
}

Rules:
- amount must be a positive number when clearly stated
- handle spoken money: "five dollars" → 5, "twelve fifty" → 12.50, "twenty bucks" → 20, "two hundred" → 200
- description is the purpose/merchant WITHOUT the amount words
- category must be exactly one of: ${categories}
- subcategory should be a short label when obvious (Hawker, Grab, Groceries, etc.), otherwise null

Examples:
'Hawker lunch five dollars' → {"amount":5,"description":"Hawker lunch","category":"Food","subcategory":"Hawker"}

'Grab to school twelve fifty' → {"amount":12.50,"description":"Grab to school","category":"Transport","subcategory":"Grab"}

'Bangladeshi taka two hundred groceries' → {"amount":200,"description":"Groceries","category":"Food","subcategory":"Groceries"}`,
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] ?? cleaned) as {
      amount?: number | null
      category?: string
      description?: string
      subcategory?: string | null
    }

    const amount =
      typeof parsed.amount === 'number' && Number.isFinite(parsed.amount) && parsed.amount > 0
        ? parsed.amount
        : null
    if (amount == null) {
      return NextResponse.json({ error: 'Could not extract amount' }, { status: 422 })
    }

    const category = normalizeExpenseCategory(parsed.category)
    const description =
      typeof parsed.description === 'string' ? parsed.description.trim() : ''
    const subcategory = normalizeExpenseSubcategory(
      category,
      typeof parsed.subcategory === 'string' && parsed.subcategory.trim()
        ? parsed.subcategory
        : description
    )

    return NextResponse.json({
      amount,
      category,
      description,
      subcategory,
    })
  } catch (error) {
    console.error('parse-voice-expense error:', error)
    return NextResponse.json({ error: 'Parse failed' }, { status: 500 })
  }
}
