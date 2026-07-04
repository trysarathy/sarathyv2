import type { BankFormat } from './types'
import { normalizeHeader } from './utils'

const FORMAT_SIGNATURES: { format: BankFormat; required: string[]; optional?: string[] }[] = [
  {
    format: 'dbs',
    required: ['transactiondate', 'description'],
    optional: ['withdrawal', 'deposit', 'withdrawals', 'deposits'],
  },
  {
    format: 'ocbc',
    required: ['transactiondate'],
    optional: ['withdrawal', 'deposit', 'withdrawals', 'deposits', 'description'],
  },
  {
    format: 'hdfc',
    required: ['date', 'narration'],
    optional: ['withdrawalamt', 'depositamt', 'withdrawal', 'deposit'],
  },
  {
    format: 'icici',
    required: ['date'],
    optional: ['transactionremarks', 'withdrawalamount', 'depositamount', 'withdrawal', 'deposit'],
  },
  {
    format: 'wise',
    required: ['date', 'amount'],
    optional: ['description', 'currency', 'status'],
  },
  {
    format: 'paytm',
    required: ['transactiondate'],
    optional: ['transactiondetails', 'amount', 'status'],
  },
]

function scoreRow(normalizedCells: string[]): { format: BankFormat; score: number } | null {
  let best: { format: BankFormat; score: number } | null = null

  for (const sig of FORMAT_SIGNATURES) {
    const hasRequired = sig.required.every(req =>
      normalizedCells.some(cell => cell.includes(req) || req.includes(cell))
    )
    if (!hasRequired) continue

    let score = sig.required.length * 2
    if (sig.optional) {
      score += sig.optional.filter(opt =>
        normalizedCells.some(cell => cell.includes(opt) || opt.includes(cell))
      ).length
    }

    if (!best || score > best.score) best = { format: sig.format, score }
  }

  return best
}

/** Scan first rows for a header line and detect bank format. */
export function detectFormat(rows: string[][]): { format: BankFormat; headerRowIndex: number } {
  const scanLimit = Math.min(rows.length, 15)

  for (let i = 0; i < scanLimit; i++) {
    const normalized = rows[i].map(normalizeHeader)
    const match = scoreRow(normalized)
    if (match && match.score >= 4) {
      return { format: match.format, headerRowIndex: i }
    }
  }

  // Fallback: first row with 3+ non-empty cells that looks like headers (contains "date" or "amount")
  for (let i = 0; i < scanLimit; i++) {
    const normalized = rows[i].map(normalizeHeader)
    const nonEmpty = normalized.filter(Boolean)
    if (nonEmpty.length >= 3) {
      const hasDateOrAmount = normalized.some(
        h => h.includes('date') || h.includes('amount') || h.includes('description') || h.includes('narration')
      )
      if (hasDateOrAmount) {
        return { format: 'simple', headerRowIndex: i }
      }
    }
  }

  return { format: 'simple', headerRowIndex: 0 }
}
