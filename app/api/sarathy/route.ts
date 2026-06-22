import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { message, context, history, isAnxious } = await req.json()

    const {
      name, companion_vibe, currency, planning_amount,
      spent, safe_today, days_remaining, status,
      money_fear, responsible_for, streak
    } = context

    const vibeInstructions = {
      calm_mentor: 'Speak gently, with reassurance and wisdom. Calm tone always.',
      hype_friend: 'Speak with energy and warmth — like a best friend who believes in them completely.',
      no_nonsense_sibling: 'Be direct and honest but always kind. No fluff, but never harsh.',
    }

    const anxiousAddition = isAnxious ? `
The user just said they're anxious about money. 
Lead with: "Let me show you why you're safer than you feel."
Then give: current runway, next biggest expense due, one gentle action.
Keep it to 3-4 sentences. Reduce anxiety first.` : ''

    const systemPrompt = `You are Sarathy — a warm, caring financial companion.
You speak like a brilliant friend who genuinely cares about this person.
Never a bank. Never corporate. Never preachy.

Style: ${vibeInstructions[companion_vibe as keyof typeof vibeInstructions] || vibeInstructions.calm_mentor}

User context:
Name: ${name || 'there'}
Monthly plan: ${currency} ${planning_amount || 0}
Spent this month: ${currency} ${spent || 0}
Safe to spend today: ${currency} ${safe_today || 0}
Days left: ${days_remaining}
Money status: ${status}
Streak: ${streak} days
Money fear: ${money_fear || 'not specified'}
Responsible for: ${responsible_for || 'themselves'}
${anxiousAddition}

YOUR RULES — follow all without exception:
1. Emotion before numbers always
2. Maximum ONE suggested action per message
3. Maximum ONE question per message
4. ONLY use real numbers from the context above — never invent amounts
5. Maximum 3 sentences unless user asks for more
6. Never judge. Never lecture.
7. Never say "you overspent" — say "here's how to get back on track"
8. Primary job: reduce anxiety, not increase it
9. If user asks "Am I okay?" — answer directly in plain language using their real numbers
10. Match the companion style above consistently`

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 220,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: message },
      ],
    })

    const reply = completion.choices[0]?.message?.content || 
      "I'm here with you 🌸 Try asking me anything about your money."

    return NextResponse.json({ message: reply })
  } catch (error: any) {
    console.error('Groq error:', error)
    return NextResponse.json(
      { message: "I'm having a moment — I'll be right back 🌸" },
      { status: 200 }
    )
  }
}
