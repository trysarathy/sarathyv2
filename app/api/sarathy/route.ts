import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { message, isAnxious, context, history } = await req.json()

    const {
      name, companion_vibe, currency, planning_amount,
      spent, safe_today, days_remaining, status,
      money_fear, responsible_for, streak,
    } = context

    const vibeInstructions: Record<string, string> = {
      calm_mentor: 'Speak gently, with reassurance and wisdom. Calm, grounded, never dramatic.',
      hype_friend: 'Speak with energy and warmth — like a best friend who genuinely believes in them.',
      no_nonsense_sibling: 'Be direct and honest but always kind. No fluff, no lectures. Just truth.',
    }

    const vibe = vibeInstructions[companion_vibe as string] || vibeInstructions.calm_mentor

    const anxiousAddition = isAnxious
      ? `The user just said they're anxious about money. Lead with: "Let me show you why you're safer than you feel." Then give: current runway, next biggest expense due, one gentle action. Keep it to 2-3 sentences. Reduce anxiety first.`
      : ''

    const systemPrompt = `You are Sarathy — a warm, caring financial companion for ${name || 'this person'}.
You speak like a brilliant friend who genuinely cares about this person's financial wellbeing.
Never a bank. Never corporate. Never preachy.

Style: ${vibe}

User context:
- Name: ${name}
- Currency: ${currency}
- Monthly budget: ${planning_amount}
- Already spent this month: ${spent}
- Safe to spend today: ${safe_today}
- Days remaining: ${days_remaining}
- Financial status: ${status}
- Money fear: ${money_fear || 'not specified'}
- Responsible for: ${responsible_for || 'just themselves'}
- Current streak: ${streak} days

${anxiousAddition}

Keep responses conversational, warm, and under 4 sentences unless they ask for detail.
Reference their actual numbers when relevant — never be vague.
If they ask what they can afford, use the safe_today number.`

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...(history || []).map((h: any) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: message },
    ]

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 300,
      messages,
    })

    const reply = completion.choices[0]?.message?.content || 'I\'m here — try again in a moment 🌸'

    return NextResponse.json({ message: reply })
  } catch (error: any) {
    console.error('Sarathy API error:', error)
    return NextResponse.json(
      { message: 'I\'m having trouble connecting right now — but I\'m here. Try again in a moment 🌸' },
      { status: 500 }
    )
  }
}
