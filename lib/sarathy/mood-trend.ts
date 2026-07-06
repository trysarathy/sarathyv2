import type { MoodLogRow, MoodTrend, MoodValue } from './types'

const STRESS_MOODS: MoodValue[] = ['anxious', 'stressed']

function normalizeMood(raw: string): MoodValue | null {
  if (raw === 'good' || raw === 'anxious' || raw === 'stressed') return raw
  return null
}

function isStressMood(mood: MoodValue): boolean {
  return STRESS_MOODS.includes(mood)
}

export function analyzeMoodTrend(logs: MoodLogRow[]): {
  last7: Array<{ date: string; mood: MoodValue }>
  trend: MoodTrend
  latest: MoodValue | null
} {
  const sorted = [...logs]
    .map((log) => {
      const mood = normalizeMood(log.mood)
      return mood ? { date: log.entry_date, mood } : null
    })
    .filter((row): row is { date: string; mood: MoodValue } => row !== null)
    .sort((a, b) => a.date.localeCompare(b.date))

  const last7 = sorted.slice(-7)
  const latest = last7.length > 0 ? last7[last7.length - 1].mood : null

  if (last7.length < 2) {
    return { last7, trend: 'unknown', latest }
  }

  const midpoint = Math.ceil(last7.length / 2)
  const earlier = last7.slice(0, midpoint)
  const recent = last7.slice(midpoint)

  const stressCount = (rows: Array<{ mood: MoodValue }>) =>
    rows.filter((r) => isStressMood(r.mood)).length

  const earlierStress = stressCount(earlier)
  const recentStress = stressCount(recent)
  const allGood = last7.every((r) => r.mood === 'good')
  const allSame = last7.every((r) => r.mood === last7[0].mood)

  if (allGood || (allSame && !isStressMood(last7[0].mood))) {
    return { last7, trend: 'stable', latest }
  }

  if (recentStress > earlierStress) {
    return { last7, trend: 'worsening', latest }
  }

  if (recentStress < earlierStress && earlierStress > 0) {
    return { last7, trend: 'improving', latest }
  }

  if (recentStress === earlierStress && recentStress > 0) {
    return { last7, trend: 'stable', latest }
  }

  return { last7, trend: 'mixed', latest }
}
