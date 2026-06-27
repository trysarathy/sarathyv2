export type DateOrder = 'day-first' | 'month-first'

function pad(value: number) {
  return value.toString().padStart(2, '0')
}

function toDateKey(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (year < 1900 || month < 1 || month > 12 || day < 1) return null

  const candidate = new Date(year, month - 1, day)
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null
  }

  return `${year}-${pad(month)}-${pad(day)}`
}

function normalizeYear(value: string) {
  const year = Number(value)
  if (value.length === 2) return year >= 70 ? 1900 + year : 2000 + year
  return year
}

export function getLocalDateKey(date = new Date()) {
  return toDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate()) || ''
}

export function detectNumericDateOrder(values: Array<string | null | undefined>): DateOrder {
  let dayFirstSignals = 0
  let monthFirstSignals = 0

  values.forEach(value => {
    const match = value?.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/)
    if (!match) return

    const first = Number(match[1])
    const second = Number(match[2])
    if (first > 12 && second <= 12) dayFirstSignals += 1
    if (second > 12 && first <= 12) monthFirstSignals += 1
  })

  return monthFirstSignals > dayFirstSignals ? 'month-first' : 'day-first'
}

export function normalizeDateKey(value?: string | null, dateOrder: DateOrder = 'day-first') {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const iso = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (iso) {
    return toDateKey(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  }

  const numeric = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/)
  if (numeric) {
    const first = Number(numeric[1])
    const second = Number(numeric[2])
    const year = normalizeYear(numeric[3])
    const inferredOrder =
      first > 12 && second <= 12
        ? 'day-first'
        : second > 12 && first <= 12
        ? 'month-first'
        : dateOrder

    const day = inferredOrder === 'day-first' ? first : second
    const month = inferredOrder === 'day-first' ? second : first
    return toDateKey(year, month, day)
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return getLocalDateKey(parsed)
}

export function isDateKeyInCurrentMonth(value?: string | null, now = new Date()) {
  return isDateKeyInMonth(value, now.getFullYear(), now.getMonth())
}

export function getDateKeyParts(value?: string | null) {
  const dateKey = normalizeDateKey(value)
  if (!dateKey) return null

  return {
    year: Number(dateKey.slice(0, 4)),
    month: Number(dateKey.slice(5, 7)),
    day: Number(dateKey.slice(8, 10)),
  }
}

export function isDateKeyInMonth(value: string | null | undefined, year: number, monthIndex: number) {
  const parts = getDateKeyParts(value)
  return Boolean(parts && parts.year === year && parts.month === monthIndex + 1)
}

export function isDateKeyWithinLastDays(value: string | null | undefined, days: number, now = new Date()) {
  const parts = getDateKeyParts(value)
  if (!parts) return false

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const entryStart = new Date(parts.year, parts.month - 1, parts.day)
  const diffDays = (todayStart.getTime() - entryStart.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= days
}

export function getCurrentMonthDateRange(now = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  return {
    monthStart: getLocalDateKey(monthStart),
    nextMonthStart: getLocalDateKey(nextMonthStart),
  }
}

export function compareDateKeysDesc(a?: string | null, b?: string | null) {
  const left = normalizeDateKey(a) || ''
  const right = normalizeDateKey(b) || ''
  return right.localeCompare(left)
}

export function formatDateKey(
  value?: string | null,
  locale = 'en-SG',
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
) {
  const dateKey = normalizeDateKey(value)
  if (!dateKey) return value || ''

  const year = Number(dateKey.slice(0, 4))
  const month = Number(dateKey.slice(5, 7))
  const day = Number(dateKey.slice(8, 10))
  const date = new Date(Date.UTC(year, month - 1, day))

  return date.toLocaleDateString(locale, { ...options, timeZone: 'UTC' })
}
