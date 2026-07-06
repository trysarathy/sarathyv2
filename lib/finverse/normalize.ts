import type { Account, Transaction } from '@finverse/sdk-typescript'
import type { FinancialBalance, FinancialTransaction } from '@/lib/financial/types'

/** Sum account balances by currency (skip closed/excluded accounts). */
export function normalizeBalances(accounts: Account[]): FinancialBalance[] {
  const byCurrency = new Map<string, number>()

  for (const acct of accounts) {
    if (acct.is_closed || acct.is_excluded) continue

    const currency =
      acct.balance?.currency || acct.account_currency || acct.ledger_balance?.currency || ''
    const amount =
      acct.balance?.value ??
      acct.ledger_balance?.value ??
      acct.statement_balance?.value

    if (!currency || amount == null) continue
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + amount)
  }

  return Array.from(byCurrency.entries()).map(([currency, amount]) => ({
    currency,
    amount: Math.round(amount * 100) / 100,
  }))
}

function isExpenseTransaction(tx: Transaction): boolean {
  const value = tx.amount?.value
  if (value == null) return false

  if (value < 0) return true

  const type = (tx.transaction_type || '').toLowerCase()
  return /debit|payment|withdrawal|purchase|fee|outgoing|transfer_out|spend/.test(type)
}

/** Map Finverse transactions to shared expense shape (outflows only, within date window). */
export function normalizeTransactions(
  transactions: Transaction[],
  days: number,
  maxCount = 50
): FinancialTransaction[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const expenses: FinancialTransaction[] = []

  for (const tx of transactions) {
    if (tx.is_pending) continue
    if (!isExpenseTransaction(tx)) continue

    const date = tx.posted_date || tx.transaction_time?.split('T')[0]
    if (!date || date < cutoffStr) continue

    const rawAmount = tx.amount!.value!
    const amount = Math.abs(rawAmount)
    const currency = tx.amount?.currency || 'SGD'
    const description =
      tx.description?.trim() ||
      tx.merchant_name?.trim() ||
      tx.transaction_reference?.trim() ||
      'Transaction'

    expenses.push({ date, description, amount, currency })
  }

  return expenses
    .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount)
    .slice(0, maxCount)
}
