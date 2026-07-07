import type { Profile } from '@/types'

/** Currencies valid as the user's primary "life" currency — not Testbank side accounts. */
export const LIFE_CURRENCIES = ['SGD', 'INR', 'USD', 'GBP', 'AUD'] as const

export type LifeCurrency = (typeof LIFE_CURRENCIES)[number]

/** Hero and safe-to-spend display always use the profile's primary life currency. */
export function getProfileDisplayCurrency(profile: Pick<Profile, 'primary_currency'>): string {
  const code = profile.primary_currency?.trim()
  if (code && isLifeCurrency(code)) return code
  return 'SGD'
}

export function isLifeCurrency(code: string): boolean {
  return LIFE_CURRENCIES.includes(code as LifeCurrency)
}
