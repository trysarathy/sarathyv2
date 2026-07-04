import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { getAuthenticatedUser } from '@/lib/supabase-server'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { transactions } = await req.json()
    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ categorized: [] })
    }
    const prompt = `Categorize each transaction into one of: Food, Transport, Social, Home, Family, Shopping, Health, Education, Entertainment, Other. Return ONLY a JSON array: [{"index":0,"category":"Food","description":"McDonald's lunch"}]. Transactions: ${transactions.map((t: any, i: number) => `${i}. Amount: ${t.amount}, Description: "${t.description}"`).join('\n')}`
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = completion.choices[0]?.message?.content || '[]'
    const cleaned = raw.replace(/```json|```/g, '').trim()
    let categorized
    try {
      categorized = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: 'Could not read categorization results. Please try again.' },
        { status: 502 }
      )
    }
    if (!Array.isArray(categorized)) {
      return NextResponse.json(
        { error: 'Unexpected response from categorization service. Please try again.' },
        { status: 502 }
      )
    }
    return NextResponse.json({ categorized })
  } catch (error) {
    console.error('parse-statement error:', error)
    return NextResponse.json(
      { error: 'Failed to categorize transactions. Please try again in a moment.' },
      { status: 500 }
    )
  }
}
