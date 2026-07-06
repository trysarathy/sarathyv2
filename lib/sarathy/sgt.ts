/** Date helpers anchored to Asia/Singapore (UTC+8, no DST). */

const TZ = 'Asia/Singapore'

export function todayInSingapore(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: TZ })
}

export function dayOfWeekInSingapore(dateStr: string): number {
  const weekday = new Date(`${dateStr}T12:00:00+08:00`).toLocaleDateString('en-US', {
    timeZone: TZ,
    weekday: 'short',
  })
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return map[weekday] ?? 0
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00+08:00`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}

/** Monday 00:00 of the calendar week containing `dateStr` (SGT). */
export function startOfWeekMondaySgt(dateStr: string): string {
  const dow = dayOfWeekInSingapore(dateStr)
  const daysBack = dow === 0 ? 6 : dow - 1
  return addDaysToDateString(dateStr, -daysBack)
}

export function dayOfMonthInSingapore(isoTimestamp: string): number {
  const day = new Intl.DateTimeFormat('en', { timeZone: TZ, day: 'numeric' }).format(
    new Date(isoTimestamp)
  )
  return parseInt(day, 10)
}
