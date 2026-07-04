import type { RowRecord } from './types'

export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function rowsToRecords(headers: string[], dataRows: string[][]): RowRecord[] {
  return dataRows
    .filter(row => row.some(cell => cell.trim().length > 0))
    .map(row => {
      const record: RowRecord = {}
      headers.forEach((header, i) => {
        record[header] = (row[i] ?? '').trim()
      })
      return record
    })
}

/** Find column index by normalized header patterns (first match wins). */
export function findColumn(headers: string[], ...patterns: string[]): number {
  const normalized = headers.map(normalizeHeader)
  for (const pattern of patterns) {
    const idx = normalized.findIndex(h => h.includes(pattern) || pattern.includes(h))
    if (idx >= 0) return idx
  }
  return -1
}

export function getField(record: RowRecord, headers: string[], ...patterns: string[]): string {
  const idx = findColumn(headers, ...patterns)
  if (idx < 0) return ''
  const key = headers[idx]
  return record[key] ?? ''
}

/** Parse amount strings: handles $, ₹, commas, parentheses negatives, leading minus. */
export function parseAmount(raw: string): number | null {
  if (!raw || !raw.trim()) return null
  let s = raw.trim()
  const isParenNegative = /^\(.*\)$/.test(s)
  s = s.replace(/[₹$£€SGDINR\s]/gi, '')
  s = s.replace(/^\((.+)\)$/, '-$1')
  s = s.replace(/,/g, '')
  const n = parseFloat(s)
  if (isNaN(n)) return null
  return isParenNegative && n > 0 ? -n : n
}

/** Normalize dates to ISO YYYY-MM-DD. Supports DD/MM/YY, DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD. */
export function parseDate(raw: string): string {
  if (!raw?.trim()) return ''
  const s = raw.trim()

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/.exec(s)
  if (dmy) {
    let [, d, m, y] = dmy
    if (y.length === 2) y = parseInt(y) > 50 ? `19${y}` : `20${y}`
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0]
  }

  return s
}

/** Expense amount: always positive; skip credits/deposits when only one side is set. */
export function expenseAmount(
  debitRaw: string,
  creditRaw: string,
  singleAmountRaw?: string
): number | null {
  const debit = parseAmount(debitRaw)
  const credit = parseAmount(creditRaw)

  if (debit != null && debit !== 0) return Math.abs(debit)
  if (credit != null && credit !== 0) return null

  if (singleAmountRaw != null) {
    const amt = parseAmount(singleAmountRaw)
    if (amt == null || amt === 0) return null
    return Math.abs(amt)
  }

  return null
}

export const MAX_TRANSACTIONS = 50
