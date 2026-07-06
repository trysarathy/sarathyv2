import type { BudgetEntryRow, SpendingDeviation } from './types'
import { addDaysToDateString, startOfWeekMondaySgt, todayInSingapore } from './sgt'

export const DEVIATION_RATIO_THRESHOLD = 1.75
export const DEVIATION_MIN_AMOUNT = 15
const BASELINE_DAYS = 30
const BASELINE_WEEKS = 4.3

export function sumByCategory(
  entries: BudgetEntryRow[],
  sinceDate?: string,
  untilDate?: string
): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const entry of entries) {
    if (sinceDate && entry.entry_date < sinceDate) continue
    if (untilDate && entry.entry_date > untilDate) continue
    totals[entry.category] = (totals[entry.category] ?? 0) + entry.amount
  }
  return totals
}

export function computeThisWeekByCategory(entries: BudgetEntryRow[]): Record<string, number> {
  const today = todayInSingapore()
  const weekStart = startOfWeekMondaySgt(today)
  return sumByCategory(entries, weekStart)
}

export function computeWeeklyBaselineByCategory(entries: BudgetEntryRow[]): Record<string, number> {
  const today = todayInSingapore()
  const baselineStart = addDaysToDateString(today, -BASELINE_DAYS)
  const totals = sumByCategory(entries, baselineStart)
  const baseline: Record<string, number> = {}
  for (const [category, total] of Object.entries(totals)) {
    baseline[category] = total / BASELINE_WEEKS
  }
  return baseline
}

function formatDeviationLabel(category: string, ratio: number): string {
  const rounded = Math.round(ratio * 10) / 10
  const multiplier =
    rounded >= 2 ? `${Math.round(rounded)}×` : `${rounded.toFixed(1).replace(/\.0$/, '')}×`
  return `${category} ${multiplier} usual`
}

export function detectNotableDeviations(
  thisWeekByCategory: Record<string, number>,
  weeklyBaselineByCategory: Record<string, number>
): SpendingDeviation[] {
  const deviations: SpendingDeviation[] = []

  for (const [category, thisWeek] of Object.entries(thisWeekByCategory)) {
    const baseline = weeklyBaselineByCategory[category] ?? 0
    if (baseline <= 0 || thisWeek < DEVIATION_MIN_AMOUNT) continue

    const ratio = thisWeek / baseline
    if (ratio < DEVIATION_RATIO_THRESHOLD) continue

    deviations.push({
      category,
      thisWeek,
      baseline: Math.round(baseline),
      ratio: Math.round(ratio * 10) / 10,
      label: formatDeviationLabel(category, ratio),
    })
  }

  return deviations.sort((a, b) => b.ratio - a.ratio)
}

export function analyzeSpendingPatterns(entries: BudgetEntryRow[]): {
  thisWeekByCategory: Record<string, number>
  weeklyBaselineByCategory: Record<string, number>
  notableDeviations: SpendingDeviation[]
} {
  const thisWeekByCategory = computeThisWeekByCategory(entries)
  const weeklyBaselineByCategory = computeWeeklyBaselineByCategory(entries)
  const notableDeviations = detectNotableDeviations(thisWeekByCategory, weeklyBaselineByCategory)

  return { thisWeekByCategory, weeklyBaselineByCategory, notableDeviations }
}
