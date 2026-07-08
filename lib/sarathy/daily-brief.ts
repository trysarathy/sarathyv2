import { getGroqClient } from '@/lib/groq'
import { createServiceSupabaseClient } from '@/lib/supabase-admin'
import { buildCompanionContext } from './context'
import { formatContextForPrompt } from './format-context'
import { todayInSingapore } from './sgt'
import type { CompanionContext } from './types'

export function buildDailyBriefPrompt(ctx: CompanionContext): string {
  const contextBlock = formatContextForPrompt(ctx)
  const softenTone =
    ctx.mood.trend === 'worsening' || ctx.mood.trend === 'mixed'
      ? 'Their mood trend suggests stress — you may soften tone slightly, but do NOT name or reference their emotional state.'
      : 'Do NOT name or reference their mood or emotional state.'

  const dream = ctx.today.savings.dream
  const dreamLine =
    dream?.targetAmount && dream.targetDate
      ? dream.funded
        ? `- Their savings dream "${dream.goalName ?? 'dream'}" is fully funded — you MAY acknowledge it warmly if relevant (one sentence, no celebration theatrics).`
        : dream.onTrack
          ? `- They have a savings dream on track (${dream.goalName ?? 'dream'}). You MAY reference progress naturally if relevant — use saved/target/on-track details from context.`
          : `- Their savings dream is behind pace. If relevant, mention honestly and pair with the required monthly amount from context — never shame.`
      : ''

  const savingsLine =
    ctx.today.savings.status === 'protected' && ctx.today.savings.monthlyGoal > 0
      ? `- When savings are protected, you MAY naturally include: "You can spend X today — and your Y savings this month is already safe." Use real X (safe-to-spend) and Y (monthly savings goal) from context.`
      : ctx.today.savings.status === 'at_risk'
        ? `- Savings are at risk. If you mention it, pair honestly with the recoverable amount from context (e.g. "S$80 still possible if this week stays light") — never a dead end.`
        : ''

  return `You are Sarathy — a warm financial companion for international students in Singapore.
Write the user's morning home-screen brief in English only (no Hinglish/Singlish — this is not a chat reply).

Requirements:
- Exactly 1 warm paragraph, max 3 sentences.
- Include: greeting with their first name (${ctx.user.firstName}), their safe-to-spend today, ONE noteworthy observation from context (spending pattern, recent notable, streak, etc.).
- Where natural, add ONE small actionable suggestion — keep it gentle, never preachy.
- Use ONLY real numbers from context — never invent amounts.
- ${softenTone}
- No bullet points. No corporate speak.
${dreamLine}
${savingsLine}
--- USER CONTEXT (ground truth) ---
${contextBlock}
--- END CONTEXT ---`
}

export async function getOrCreateDailyBrief(
  userId: string
): Promise<{ brief: string; cached: boolean } | null> {
  const supabase = createServiceSupabaseClient()
  const briefDate = todayInSingapore()

  const { data: existing } = await supabase
    .from('daily_briefs')
    .select('content')
    .eq('user_id', userId)
    .eq('brief_date', briefDate)
    .maybeSingle()

  if (existing?.content) {
    return { brief: existing.content, cached: true }
  }

  let ctx: CompanionContext
  try {
    ctx = await buildCompanionContext(userId)
  } catch (error) {
    console.error('daily-brief context error:', error)
    return null
  }

  let content: string
  try {
    const completion = await getGroqClient().chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 120,
      messages: [{ role: 'user', content: buildDailyBriefPrompt(ctx) }],
    })
    content = completion.choices[0]?.message?.content?.trim() ?? ''
    if (!content) return null
  } catch (error) {
    console.error('daily-brief Groq error:', error)
    return null
  }

  const { error: insertError } = await supabase.from('daily_briefs').insert({
    user_id: userId,
    brief_date: briefDate,
    content,
  })

  if (insertError && insertError.code !== '23505') {
    console.error('daily-brief insert error:', insertError)
  }

  const { data: cached } = await supabase
    .from('daily_briefs')
    .select('content')
    .eq('user_id', userId)
    .eq('brief_date', briefDate)
    .maybeSingle()

  if (cached?.content) {
    return { brief: cached.content, cached: Boolean(existing) }
  }

  return { brief: content, cached: false }
}
