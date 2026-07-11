const DONE_KEY = 'sarathy_feedback_prompt_v1'
const ACTIVE_MS_KEY = 'sarathy_feedback_active_ms_v1'

export const FEEDBACK_ACTIVE_MS = 3 * 60 * 1000

export function isFeedbackPromptDone(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(DONE_KEY) === '1'
  } catch {
    return true
  }
}

export function markFeedbackPromptDone(): void {
  try {
    localStorage.setItem(DONE_KEY, '1')
    localStorage.removeItem(ACTIVE_MS_KEY)
  } catch {
    // ignore quota / private mode
  }
}

export function getFeedbackActiveMs(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = localStorage.getItem(ACTIVE_MS_KEY)
    const n = raw ? parseInt(raw, 10) : 0
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

export function setFeedbackActiveMs(ms: number): void {
  try {
    localStorage.setItem(ACTIVE_MS_KEY, String(Math.max(0, Math.floor(ms))))
  } catch {
    // ignore
  }
}
