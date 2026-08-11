import { currencySymbol } from '@/lib/currency/convert'
import type { BudgetEntry, FixedSpending } from '@/types'

/** Nudge system uses a fixed 30-day month (per product spec). */
export const NUDGE_DAYS_PER_MONTH = 30

export type NudgeLevel = 'healthy' | 'ok' | 'warn' | 'over'

export interface DailyBudgetSnapshot {
  dailyBudget: number
  todaySpent: number
  fixedDailyCosts: number
  /** dailyBudget − todaySpent (can be negative when over). */
  remaining: number
  /** remaining / dailyBudget; null when no budget set. */
  percentageRemaining: number | null
  level: NudgeLevel
  hasBudget: boolean
}

export function monthlyFixedTotal(fixed: Pick<FixedSpending, 'amount' | 'is_active'>[]): number {
  return fixed.filter((f) => f.is_active !== false).reduce((sum, f) => sum + (f.amount || 0), 0)
}

export function fixedDailyCosts(fixed: Pick<FixedSpending, 'amount' | 'is_active'>[]): number {
  return monthlyFixedTotal(fixed) / NUDGE_DAYS_PER_MONTH
}

export function dailyBudgetFromPlan(planningAmount: number | null | undefined): number {
  const plan = planningAmount || 0
  if (plan <= 0) return 0
  return plan / NUDGE_DAYS_PER_MONTH
}

export function sumSpentOnDate(entries: Pick<BudgetEntry, 'amount' | 'entry_date'>[], date: string): number {
  return entries
    .filter((e) => e.entry_date?.slice(0, 10) === date)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
}

/**
 * Budget status for pre-spend nudges.
 * `pendingAmount` = expense about to be logged (pre-save) or already included in todaySpent (post-save).
 */
export function getDailyBudgetSnapshot(params: {
  planningAmount: number | null | undefined
  todaySpent: number
  /** Extra amount not yet in todaySpent (pre-save preview). */
  pendingAmount?: number
  fixedSpending?: Pick<FixedSpending, 'amount' | 'is_active'>[]
  /** When true, subtract fixed daily costs (morning greeting). */
  subtractFixed?: boolean
}): DailyBudgetSnapshot {
  const dailyBudget = dailyBudgetFromPlan(params.planningAmount)
  const fixed = params.subtractFixed ? fixedDailyCosts(params.fixedSpending || []) : 0
  const pending = Math.max(0, params.pendingAmount || 0)
  const todaySpent = Math.max(0, params.todaySpent) + pending
  const remaining = dailyBudget - fixed - todaySpent
  const hasBudget = dailyBudget > 0
  const percentageRemaining = hasBudget ? remaining / dailyBudget : null

  let level: NudgeLevel = 'ok'
  if (!hasBudget) level = 'ok'
  else if (remaining < 0) level = 'over'
  else if (percentageRemaining != null && percentageRemaining < 0.2) level = 'warn'
  else if (percentageRemaining != null && percentageRemaining > 0.5) level = 'healthy'
  else level = 'ok'

  return {
    dailyBudget,
    todaySpent,
    fixedDailyCosts: fixed,
    remaining,
    percentageRemaining,
    level,
    hasBudget,
  }
}

/** Post-save push: warn below 30%, or over. */
export function shouldSendBudgetNudge(percentageRemaining: number | null): 'low' | 'over' | null {
  if (percentageRemaining == null) return null
  if (percentageRemaining < 0) return 'over'
  if (percentageRemaining < 0.3) return 'low'
  return null
}

export function formatNudgeMoney(amount: number, currency: string): string {
  const n = Math.abs(Number.isFinite(amount) ? amount : 0)
  const symbol = currencySymbol(currency)
  if (Math.abs(n - Math.round(n)) < 0.05) return `${symbol}${Math.round(n)}`
  return `${symbol}${n.toFixed(2)}`
}

/** Top spend category for a given calendar day. */
export function topSpendCategoryForDate(
  entries: Pick<BudgetEntry, 'amount' | 'entry_date' | 'category'>[],
  date: string
): { category: string; total: number } | null {
  const day = entries.filter((e) => e.entry_date?.slice(0, 10) === date)
  if (day.length === 0) return null
  const byCat = new Map<string, number>()
  for (const e of day) {
    const cat = e.category || 'Other'
    byCat.set(cat, (byCat.get(cat) || 0) + (Number(e.amount) || 0))
  }
  let best: { category: string; total: number } | null = null
  for (const [category, total] of Array.from(byCat.entries())) {
    if (!best || total > best.total) best = { category, total }
  }
  return best
}
