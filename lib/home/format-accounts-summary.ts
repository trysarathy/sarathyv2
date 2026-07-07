import type { FinancialBalance } from '@/lib/financial/types'

export function formatBalanceCompact(amount: number, currency: string): string {
  if (currency === 'SGD') {
    return `S$${amount.toLocaleString('en-SG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }
  if (currency === 'INR') {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  }
  if (currency === 'USD') {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }
  return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

/** Sum balances by currency across providers. */
export function mergeBalances(lists: FinancialBalance[][]): Map<string, number> {
  const map = new Map<string, number>()
  for (const list of lists) {
    for (const { currency, amount } of list) {
      if (amount > 0) {
        map.set(currency, (map.get(currency) ?? 0) + amount)
      }
    }
  }
  return map
}

/** Primary · secondary order, always. Omits when no nonzero balances. */
export function buildAccountsSummary(
  primaryCurrency: string,
  secondaryCurrency: string | null | undefined,
  balanceMap: Map<string, number>
): string | null {
  const parts: string[] = []

  const primaryAmount = balanceMap.get(primaryCurrency)
  if (primaryAmount && primaryAmount > 0) {
    parts.push(formatBalanceCompact(primaryAmount, primaryCurrency))
  }

  if (secondaryCurrency) {
    const secondaryAmount = balanceMap.get(secondaryCurrency)
    if (secondaryAmount && secondaryAmount > 0) {
      parts.push(formatBalanceCompact(secondaryAmount, secondaryCurrency))
    }
  }

  if (parts.length === 0) return null
  return `${parts.join(' · ')} across accounts`
}
