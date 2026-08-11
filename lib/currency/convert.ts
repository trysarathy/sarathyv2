/**
 * Currency conversion helpers.
 * BDT uses a fixed approximate rate; other pairs use exchangerate-api when possible.
 */

/** 1 unit of currency → SGD (fixed approximations). */
export const FIXED_TO_SGD: Record<string, number> = {
  BDT: 0.013, // 1 BDT ≈ 0.013 SGD
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  SGD: 'S$',
  INR: '₹',
  BRL: 'R$',
  CNY: '¥',
  VND: '₫',
  PHP: '₱',
  USD: '$',
  GBP: '£',
  AUD: 'A$',
  EUR: '€',
  CAD: 'C$',
  MYR: 'RM',
  BDT: '৳',
}

export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code
}

/** Format like ৳200 or S$2.60 — used in recent expense dual display. */
export function formatMoneyAmount(amount: number, currency: string, decimals?: number): string {
  const n = Number.isFinite(amount) ? amount : 0
  const d =
    decimals ?? (currency === 'VND' || currency === 'IDR' || currency === 'BDT' ? 0 : 2)
  const symbol = currencySymbol(currency)
  return `${symbol}${n.toFixed(d)}`
}

async function fetchLiveRate(from: string, to: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`)
    if (!res.ok) return null
    const data = await res.json()
    const rate = data.rates?.[to]
    return typeof rate === 'number' && rate > 0 ? rate : null
  } catch {
    return null
  }
}

function toSgdFixed(amount: number, from: string): number | null {
  if (from === 'SGD') return amount
  const rate = FIXED_TO_SGD[from]
  return rate != null ? amount * rate : null
}

function fromSgdFixed(sgdAmount: number, to: string): number | null {
  if (to === 'SGD') return sgdAmount
  const rate = FIXED_TO_SGD[to]
  return rate != null ? sgdAmount / rate : null
}

/**
 * Convert `amount` from `fromCurrency` into `toCurrency`.
 * Prefer fixed BDT↔SGD (1 BDT = 0.013 SGD); otherwise live rates.
 */
export async function convertCurrencyAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  const from = fromCurrency.trim().toUpperCase()
  const to = toCurrency.trim().toUpperCase()
  if (!Number.isFinite(amount) || amount <= 0) return amount
  if (from === to) return amount

  const involvesFixed = Boolean(FIXED_TO_SGD[from] || FIXED_TO_SGD[to])

  if (involvesFixed) {
    // Normalize to SGD via fixed table and/or live rates, then to target
    let sgd: number | null = toSgdFixed(amount, from)
    if (sgd == null) {
      const liveToSgd = await fetchLiveRate(from, 'SGD')
      sgd = liveToSgd != null ? amount * liveToSgd : null
    }
    if (sgd == null) return amount

    const converted = fromSgdFixed(sgd, to)
    if (converted != null) return parseFloat(converted.toFixed(2))

    const liveFromSgd = await fetchLiveRate('SGD', to)
    if (liveFromSgd != null) return parseFloat((sgd * liveFromSgd).toFixed(2))
    return parseFloat(sgd.toFixed(2))
  }

  const live = await fetchLiveRate(from, to)
  if (live != null) return parseFloat((amount * live).toFixed(2))
  return amount
}
