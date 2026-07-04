import type { WiseTransaction } from './types'
import type { BudgetEntry } from '@/types'

export function wiseDedupKey(date: string, description: string, amount: number): string {
  return `${date}|${description.trim().toLowerCase()}|${amount.toFixed(2)}`
}

export interface WiseImportItem {
  transaction: WiseTransaction
  amount: number
}

export function filterNewWiseTransactions(
  transactions: WiseTransaction[],
  existing: BudgetEntry[],
  convertedAmounts: number[]
): { toImport: WiseImportItem[]; skipped: number } {
  const existingKeys = new Set(
    existing.map(e => wiseDedupKey(e.entry_date, e.description || '', e.amount))
  )

  const toImport: WiseImportItem[] = []
  let skipped = 0

  transactions.forEach((tx, i) => {
    const amount = convertedAmounts[i]
    const key = wiseDedupKey(tx.date, tx.description, amount)
    if (existingKeys.has(key)) {
      skipped++
    } else {
      toImport.push({ transaction: tx, amount })
      existingKeys.add(key)
    }
  })

  return { toImport, skipped }
}

/** Convert amount to profile currency using exchangerate-api (same pattern as LogExpenseSheet). */
export async function convertToProfileCurrency(
  amount: number,
  fromCurrency: string,
  profileCurrency: string
): Promise<number> {
  if (fromCurrency === profileCurrency) return amount
  try {
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`)
    const data = await res.json()
    const rate = data.rates?.[profileCurrency]
    if (rate) return parseFloat((amount * rate).toFixed(2))
  } catch {
    // fall through
  }
  return amount
}

export function inferCategory(description: string): string {
  const d = description.toLowerCase()
  if (/grab|mrt|simplygo|transport|gojek|taxi/.test(d)) return 'Transport'
  if (/fairprice|cold storage|grocery|koufu|foodpanda|deliveroo|food|canteen|pizza|thai express/.test(d)) return 'Food'
  if (/remittance|hdfc|icici|family|india|transfer to/.test(d)) return 'Family'
  if (/netflix|spotify|entertainment/.test(d)) return 'Entertainment'
  if (/rent|utility|bill/.test(d)) return 'Home'
  return 'Other'
}
