import type { Profile } from '@/types'

/**
 * Currencies valid as the user's primary "life" currency.
 * Used on home (safe-to-spend, progress), onboarding, and Profile.
 */
export const LIFE_CURRENCIES = [
  'SGD',
  'INR',
  'BRL',
  'CNY',
  'VND',
  'PHP',
  'USD',
  'GBP',
] as const

export type LifeCurrency = (typeof LIFE_CURRENCIES)[number]

export const LIFE_CURRENCY_OPTIONS: Array<{
  code: LifeCurrency
  flag: string
  label: string
  symbol: string
}> = [
  { code: 'SGD', flag: '🇸🇬', label: 'SGD — Singapore Dollar', symbol: 'S$' },
  { code: 'INR', flag: '🇮🇳', label: 'INR — Indian Rupee', symbol: '₹' },
  { code: 'BRL', flag: '🇧🇷', label: 'BRL — Brazilian Real', symbol: 'R$' },
  { code: 'CNY', flag: '🇨🇳', label: 'CNY — Chinese Yuan', symbol: '¥' },
  { code: 'VND', flag: '🇻🇳', label: 'VND — Vietnamese Dong', symbol: '₫' },
  { code: 'PHP', flag: '🇵🇭', label: 'PHP — Philippine Peso', symbol: '₱' },
  { code: 'USD', flag: '🇺🇸', label: 'USD — US Dollar', symbol: '$' },
  { code: 'GBP', flag: '🇬🇧', label: 'GBP — British Pound', symbol: '£' },
]

export const DEFAULT_PRIMARY_CURRENCY: LifeCurrency = 'SGD'

/** Hero and safe-to-spend display always use the profile's primary life currency. */
export function getProfileDisplayCurrency(profile: Pick<Profile, 'primary_currency'>): string {
  const code = profile.primary_currency?.trim()
  if (code && isLifeCurrency(code)) return code
  return DEFAULT_PRIMARY_CURRENCY
}

export function isLifeCurrency(code: string): code is LifeCurrency {
  return (LIFE_CURRENCIES as readonly string[]).includes(code)
}

export function normalizePrimaryCurrency(value: string | null | undefined): LifeCurrency {
  if (value && isLifeCurrency(value.trim())) return value.trim() as LifeCurrency
  return DEFAULT_PRIMARY_CURRENCY
}
