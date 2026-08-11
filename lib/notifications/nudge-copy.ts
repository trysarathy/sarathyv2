import type { CompanionTone } from '@/lib/notifications/copy'
import { formatNudgeMoney } from '@/lib/nudge/daily-budget'

export type BudgetNudgeKind = 'low' | 'over'

export interface NudgeCopy {
  title: string
  body: string
}

function money(amount: number, currency: string): string {
  return formatNudgeMoney(amount, currency)
}

/** TRIGGER 1 — after expense, below 30% remaining or over budget. */
export function getBudgetWarningCopy(
  kind: BudgetNudgeKind,
  vibe: CompanionTone | string | null | undefined,
  amount: number,
  currency: string
): NudgeCopy {
  const x = money(amount, currency)
  const tone: CompanionTone =
    vibe === 'hype_friend' || vibe === 'no_nonsense_sibling' || vibe === 'calm_mentor'
      ? vibe
      : 'calm_mentor'

  if (kind === 'over') {
    switch (tone) {
      case 'hype_friend':
        return {
          title: 'Sarathy',
          body: `You've gone a little over today 😬\n${x} over budget. Tomorrow is a fresh start.`,
        }
      case 'no_nonsense_sibling':
        return {
          title: 'Sarathy',
          body: `Over budget by ${x}. You know what to do.`,
        }
      case 'calm_mentor':
      default:
        return {
          title: 'Sarathy',
          body: `Today's budget has been exceeded by ${x}.\nReflect on what drove this.`,
        }
    }
  }

  // low — under 30% remaining
  switch (tone) {
    case 'hype_friend':
      return {
        title: 'Sarathy',
        body: `Heads up 👀 You have ${x} left today.\nDinner plans?`,
      }
    case 'no_nonsense_sibling':
      return {
        title: 'Sarathy',
        body: `${x} left today. That's it.`,
      }
    case 'calm_mentor':
    default:
      return {
        title: 'Sarathy',
        body: `You have ${x} remaining for today.\nWorth being mindful of the next spend.`,
      }
  }
}

/** TRIGGER 3 — morning safe-to-spend. */
export function getMorningSafeCopy(params: {
  safeToday: number
  currency: string
  yesterdayTop?: { category: string; total: number } | null
}): NudgeCopy {
  const x = money(params.safeToday, params.currency)
  let body = `Good morning. You have ${x} today.`
  if (params.yesterdayTop && params.yesterdayTop.total > 0) {
    const y = money(params.yesterdayTop.total, params.currency)
    body += `\nYesterday's top spend: ${params.yesterdayTop.category} · ${y}`
  }
  return { title: 'Sarathy', body }
}
