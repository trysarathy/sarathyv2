/** Map API / Supabase noise to booth-safe copy — never show raw errors to users. */

function lower(msg: string): string {
  return msg.toLowerCase()
}

export function friendlyExpenseSaveError(raw?: string | null): string {
  if (!raw?.trim()) {
    return 'Could not save this expense. Please try again.'
  }
  const m = lower(raw)
  if (m.includes('jwt') || m.includes('not authenticated') || m.includes('unauthorized')) {
    return 'Your session expired — refresh the page and try again.'
  }
  if (m.includes('duplicate') || m.includes('unique')) {
    return 'This expense may already be saved. Check This month or try again.'
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'Connection hiccup — check your network and try again.'
  }
  return 'Could not save this expense. Please try again.'
}

export function friendlyVoiceParseError(raw?: string | null): string {
  if (!raw?.trim()) return "Didn't catch that — try speaking a bit slower."
  const m = lower(raw)
  if (m.includes('unauthorized') || m.includes('jwt')) {
    return 'Sign in again, then try voice logging.'
  }
  if (m.includes('no transcript')) {
    return "Didn't hear anything — tap the mic and try again."
  }
  return "Didn't catch that — try 'spent 8 dollars on lunch'."
}

export function friendlySyncError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { message?: string; details?: string; hint?: string }
    const combined = [e.message, e.details, e.hint].filter(Boolean).join(' ')
    if (combined) {
      const m = lower(combined)
      if (m.includes('duplicate') || m.includes('unique')) {
        return 'Those transactions are already in your budget.'
      }
      if (m.includes('jwt') || m.includes('unauthorized')) {
        return 'Session expired — refresh the page and try again.'
      }
    }
  }
  if (err instanceof Error) {
    const m = lower(err.message)
    if (m.includes('duplicate') || m.includes('unique')) {
      return 'Those transactions are already in your budget.'
    }
  }
  return 'Could not sync right now. Your data is safe — try again in a moment.'
}

export function friendlyCircleError(raw?: string | null, fallback = 'Something went wrong — please try again.'): string {
  if (!raw?.trim()) return fallback
  const m = lower(raw)
  if (m.includes('unauthorized') || m.includes('jwt')) {
    return 'Sign in again to continue with your circle.'
  }
  if (m.includes('not a participant')) {
    return 'You are not part of this split.'
  }
  if (m.includes('not a member')) {
    return 'You need to be in this circle to do that.'
  }
  if (m.includes('not found')) {
    return 'That split is no longer available.'
  }
  if (m.includes('failed to create') || m.includes('create split')) {
    return 'Could not share the split — check your connection and try again.'
  }
  if (m.includes('claim') || m.includes('add your share')) {
    return 'Could not add your share — try again in a moment.'
  }
  if (m.includes('description') || m.includes('amount') || m.includes('member')) {
    return raw
  }
  return fallback
}

export function friendlyHomeLoadError(): string {
  return 'We could not load your home screen. Tap retry — your data is still safe.'
}

export function friendlyBriefError(): string {
  return "Today's brief is resting — your safe-to-spend below is up to date."
}

export function friendlyChatError(): string {
  return "I'm having trouble connecting right now — but I'm here. Try again in a moment 🌸"
}

export function friendlyFinverseLinkError(reason?: string | null): string {
  if (!reason?.trim()) {
    return 'Bank link did not complete — you can try again anytime.'
  }
  const m = lower(reason)
  if (m.includes('cancel') || m.includes('denied') || m.includes('abort')) {
    return 'Bank link cancelled — no changes were made.'
  }
  return 'Bank link did not complete — you can try again anytime.'
}

export function friendlyWiseLoadError(): string {
  return 'Wise is unavailable right now — you can still log expenses manually.'
}

export function friendlyBankLoadError(): string {
  return 'Bank connection unavailable — you can still log expenses manually.'
}
