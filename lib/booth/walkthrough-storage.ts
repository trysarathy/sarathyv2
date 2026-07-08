const STORAGE_KEY = 'sarathy_home_walkthrough_v1'

export function isHomeWalkthroughDone(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

export function markHomeWalkthroughDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // ignore quota / private mode
  }
}
