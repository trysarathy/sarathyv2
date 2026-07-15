import type { Profile } from '@/types'

export type CompanionTone = Profile['companion_vibe']

export interface ReminderCopy {
  title: string
  body: string
}

const REMINDER_COPY: Record<CompanionTone, ReminderCopy> = {
  hype_friend: {
    title: "Hey! 👋 Don't forget me",
    body: "You haven't logged anything today — what did you spend on? Tell me everything 😄",
  },
  calm_mentor: {
    title: 'Daily check-in 🌿',
    body: "Take a moment to log today's expenses. Small habits build big clarity.",
  },
  no_nonsense_sibling: {
    title: 'Oi. Log your expenses. 📝',
    body: "You know you'll forget by tomorrow. Do it now, takes 10 seconds.",
  },
}

export function getToneLabel(vibe: CompanionTone | string | null | undefined): string {
  switch (vibe) {
    case 'hype_friend':
      return 'Best Friend'
    case 'no_nonsense_sibling':
      return 'No-nonsense Sibling'
    case 'calm_mentor':
    default:
      return 'Calm Mentor'
  }
}

export function getReminderCopy(
  vibe: CompanionTone | string | null | undefined
): ReminderCopy {
  if (vibe === 'hype_friend' || vibe === 'no_nonsense_sibling' || vibe === 'calm_mentor') {
    return REMINDER_COPY[vibe]
  }
  return REMINDER_COPY.calm_mentor
}

/** Deep link opened when the user taps a reminder notification. */
export const LOG_EXPENSE_DEEP_LINK = '/home?log=expense'

/** Normalize DB time (`20:00:00` or `20:00`) → `HH:MM` (snapped to 5-minute steps). */
export function normalizeNotificationTime(value: string | null | undefined): string {
  if (!value) return '20:00'
  const match = String(value).match(/^(\d{1,2}):(\d{2})/)
  if (!match) return '20:00'
  const h = Math.min(23, Math.max(0, parseInt(match[1], 10)))
  let m = Math.min(59, Math.max(0, parseInt(match[2], 10)))
  m = Math.round(m / 5) * 5
  if (m === 60) return `${String(Math.min(23, h + 1)).padStart(2, '0')}:00`
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatNotificationTimeLabel(value: string | null | undefined): string {
  const [hStr, mStr] = normalizeNotificationTime(value).split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}
