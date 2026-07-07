import type { SupabaseClient } from '@supabase/supabase-js'
import type { FinancialTransaction } from './types'
import type { BudgetEntry } from '@/types'

export function dedupKey(date: string, description: string, amount: number): string {
  return `${date}|${description.trim().toLowerCase()}|${amount.toFixed(2)}`
}

export interface ImportItem {
  transaction: FinancialTransaction
  amount: number
}

export function filterNewTransactions(
  transactions: FinancialTransaction[],
  existing: BudgetEntry[],
  convertedAmounts: number[]
): { toImport: ImportItem[]; skipped: number } {
  const existingKeys = new Set(
    existing.map(e => dedupKey(e.entry_date, e.description || '', e.amount))
  )

  const toImport: ImportItem[] = []
  let skipped = 0

  transactions.forEach((tx, i) => {
    const amount = convertedAmounts[i]
    const key = dedupKey(tx.date, tx.description, amount)
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

  const tryConvert = async (base: string, target: string): Promise<number | null> => {
    try {
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${base}`)
      if (!res.ok) return null
      const data = await res.json()
      const rate = data.rates?.[target]
      if (typeof rate === 'number' && rate > 0) {
        return parseFloat((amount * rate).toFixed(2))
      }
    } catch {
      // try reverse base next
    }
    return null
  }

  const direct = await tryConvert(fromCurrency, profileCurrency)
  if (direct != null) return direct

  const reverse = await tryConvert(profileCurrency, fromCurrency)
  if (reverse != null) return parseFloat((amount / reverse).toFixed(2))

  throw new Error(`Could not convert ${fromCurrency} to ${profileCurrency}`)
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

export function formatSyncError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { message?: string; details?: string; hint?: string }
    const parts = [e.message, e.details, e.hint].filter(Boolean)
    if (parts.length) return parts.join(' — ')
  }
  if (err instanceof Error) return err.message
  return 'Sync failed'
}

export interface SyncExpensesResult {
  imported: number
  skipped: number
  message: string
}

/** Import normalized transactions into budget_entries with dedup and auto-categorization. */
export async function syncExpensesToBudget(params: {
  supabase: SupabaseClient
  userId: string
  profileCurrency: string
  transactions: FinancialTransaction[]
  existingEntries: BudgetEntry[]
  loggedVia: string
}): Promise<SyncExpensesResult> {
  const { supabase, userId, profileCurrency, transactions, existingEntries, loggedVia } = params

  const convertedAmounts: number[] = []
  const conversionErrors: string[] = []

  for (const tx of transactions) {
    try {
      convertedAmounts.push(
        await convertToProfileCurrency(tx.amount, tx.currency, profileCurrency)
      )
    } catch {
      conversionErrors.push(`${tx.description} (${tx.currency})`)
      convertedAmounts.push(NaN)
    }
  }

  const convertible = transactions.filter((_, i) => !Number.isNaN(convertedAmounts[i]))
  const convertibleAmounts = convertedAmounts.filter(a => !Number.isNaN(a))

  const { toImport, skipped } = filterNewTransactions(
    convertible,
    existingEntries,
    convertibleAmounts
  )

  if (!toImport.length) {
    const fxNote =
      conversionErrors.length > 0
        ? ` · ${conversionErrors.length} skipped (FX conversion failed)`
        : ''
    return {
      imported: 0,
      skipped: skipped + conversionErrors.length,
      message: `All ${skipped + conversionErrors.length} transaction${skipped + conversionErrors.length === 1 ? '' : 's'} already synced or skipped${fxNote}`,
    }
  }

  const rows = toImport.map(({ transaction: tx, amount: finalAmount }) => ({
    user_id: userId,
    category: inferCategory(tx.description),
    amount: finalAmount,
    original_amount: tx.currency !== profileCurrency ? tx.amount : null,
    original_currency: tx.currency !== profileCurrency ? tx.currency : null,
    description: tx.description,
    entry_date: tx.date,
    logged_via: loggedVia,
  }))

  const { error: insertError } = await supabase.from('budget_entries').insert(rows)
  if (insertError) throw insertError

  const imported = rows.length
  const fxNote =
    conversionErrors.length > 0 ? ` · ${conversionErrors.length} skipped (FX failed)` : ''
  return {
    imported,
    skipped: skipped + conversionErrors.length,
    message: `Synced ${imported} transaction${imported === 1 ? '' : 's'}${skipped ? ` · ${skipped} skipped as duplicates` : ''}${fxNote}`,
  }
}
