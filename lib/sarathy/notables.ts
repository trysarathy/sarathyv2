import type { BudgetEntryRow, RecentNotable } from './types'
import { addDaysToDateString, todayInSingapore } from './sgt'

const LARGE_EXPENSE_FLOOR = 50

function largeExpenseThreshold(safeToSpend: number): number {
  return Math.max(LARGE_EXPENSE_FLOOR, safeToSpend * 0.25)
}

export function detectRecentNotables(
  entries: BudgetEntryRow[],
  safeToSpend: number
): RecentNotable[] {
  const today = todayInSingapore()
  const threeDaysAgo = addDaysToDateString(today, -2)
  const thirtyDaysAgo = addDaysToDateString(today, -30)

  const recent = entries.filter((e) => e.entry_date >= threeDaysAgo && e.entry_date <= today)
  const prior = entries.filter(
    (e) => e.entry_date >= thirtyDaysAgo && e.entry_date < threeDaysAgo
  )

  const priorCategories = new Set(prior.map((e) => e.category))
  const notables: RecentNotable[] = []
  const seenNewCategories = new Set<string>()
  const threshold = largeExpenseThreshold(safeToSpend)

  for (const entry of recent) {
    if (entry.amount >= threshold) {
      notables.push({
        kind: 'large_expense',
        date: entry.entry_date,
        category: entry.category,
        amount: entry.amount,
        description: entry.description,
      })
    }

    if (!priorCategories.has(entry.category) && !seenNewCategories.has(entry.category)) {
      seenNewCategories.add(entry.category)
      notables.push({
        kind: 'new_category',
        date: entry.entry_date,
        category: entry.category,
        amount: entry.amount,
        description: entry.description,
      })
    }
  }

  return notables.sort((a, b) => b.date.localeCompare(a.date))
}
