import { formatCurrency } from '@/lib/calculations'
import type { CompanionContext, RecentNotable } from './types'

function formatNotable(notable: RecentNotable, currency: string): string {
  const amount = formatCurrency(notable.amount, currency)
  if (notable.kind === 'large_expense') {
    const detail = notable.description ? ` (${notable.description})` : ''
    return `${amount} ${notable.category}${detail} on ${notable.date}`
  }
  return `new spending category: ${notable.category} (${amount})`
}

function formatMoodTrend(ctx: CompanionContext): string {
  const { last7, trend } = ctx.mood
  if (last7.length === 0) return 'mood: no check-ins this week'
  const stressDays = last7.filter((m) => m.mood !== 'good').length
  return `mood trend ${trend} (${stressDays}/${last7.length} days not-good)`
}

function formatRemittance(ctx: CompanionContext): string | null {
  if (!ctx.remittance?.hasHistory) return null
  const { typicalAmount, typicalDayOfMonth, currency } = ctx.remittance
  const parts: string[] = []
  if (typicalAmount) parts.push(`typical send ${formatCurrency(typicalAmount, currency)}`)
  if (typicalDayOfMonth) parts.push(`usually around the ${typicalDayOfMonth}th`)
  return parts.length > 0 ? parts.join(', ') : null
}

function formatSync(ctx: CompanionContext): string {
  const parts: string[] = []
  if (ctx.sync.wise.connected) {
    parts.push(
      ctx.sync.wise.lastImportAt
        ? `Wise synced (${ctx.sync.wise.mode}, last ${ctx.sync.wise.lastImportAt})`
        : `Wise ${ctx.sync.wise.mode} mode`
    )
  }
  if (ctx.sync.finverse.connected) {
    const bank = ctx.sync.finverse.institutionName ?? 'bank'
    parts.push(
      ctx.sync.finverse.lastImportAt
        ? `Finverse linked (${bank}, last import ${ctx.sync.finverse.lastImportAt})`
        : `Finverse linked (${bank})`
    )
  }
  return parts.length > 0 ? parts.join(' · ') : 'no bank sync connected'
}

/** Compact prose block for LLM prompts (~400 tokens). */
export function formatContextForPrompt(ctx: CompanionContext): string {
  const { user, today, spending, gamification } = ctx
  const currency = user.currency
  const safe = formatCurrency(today.safeToSpend, currency)
  const budget = formatCurrency(today.budget, currency)
  const spent = formatCurrency(today.spentThisMonth, currency)
  const todaySpent =
    today.spentToday > 0 ? ` · ${formatCurrency(today.spentToday, currency)} spent today` : ''

  const deviationText =
    spending.notableDeviations.length > 0
      ? spending.notableDeviations
          .slice(0, 3)
          .map((d) => `${d.label} (${formatCurrency(d.thisWeek, currency)} this week)`)
          .join(' · ')
      : 'spending on track vs usual'

  const notableText =
    ctx.recentNotables.length > 0
      ? ctx.recentNotables
          .slice(0, 2)
          .map((n) => formatNotable(n, currency))
          .join(' · ')
      : null

  const remittanceText = formatRemittance(ctx)
  const homeContext = [user.homeCountry, user.currentCountry].filter(Boolean).join(' → ')

  const lines = [
    `${user.firstName} · ${currency} · ${today.status} · safe ${safe}/day · ${today.daysLeftInMonth} days left · ${spent}/${budget} spent this month${todaySpent}`,
    deviationText,
    `streak ${gamification.streak} · ${gamification.levelName} (${gamification.totalXp} XP) · ${formatMoodTrend(ctx)}`,
    remittanceText,
    formatSync(ctx),
    homeContext ? `from ${homeContext}` : null,
    user.moneyFear ? `money fear: ${user.moneyFear}` : null,
    notableText ? `recent: ${notableText}` : null,
  ].filter(Boolean)

  return lines.join(' · ')
}
