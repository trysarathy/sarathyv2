import type { RemittanceLogRow } from './types'
import { dayOfMonthInSingapore } from './sgt'

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

function modeDayOfMonth(days: number[]): number | null {
  if (days.length === 0) return null
  const counts = new Map<number, number>()
  for (const day of days) {
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  let bestDay: number | null = null
  let bestCount = 0
  for (const [day, count] of Array.from(counts.entries())) {
    if (count > bestCount) {
      bestDay = day
      bestCount = count
    }
  }
  return bestDay
}

export function analyzeRemittanceRhythm(logs: RemittanceLogRow[]): {
  hasHistory: boolean
  typicalAmount: number | null
  typicalDayOfMonth: number | null
  lastSentAt: string | null
  currency: string
} | null {
  if (logs.length === 0) return null

  const sorted = [...logs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const amounts = sorted.map((l) => l.amount_sent)
  const days = sorted.map((l) => dayOfMonthInSingapore(l.created_at))
  const typicalAmount = median(amounts)
  const typicalDayOfMonth = modeDayOfMonth(days)

  return {
    hasHistory: true,
    typicalAmount: typicalAmount !== null ? Math.round(typicalAmount) : null,
    typicalDayOfMonth,
    lastSentAt: sorted[0].created_at,
    currency: sorted[0].from_currency || 'SGD',
  }
}
