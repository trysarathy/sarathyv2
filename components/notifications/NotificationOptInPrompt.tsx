'use client'

import { getToneLabel } from '@/lib/notifications/copy'
import type { Profile } from '@/types'

interface Props {
  vibe: Profile['companion_vibe'] | string
  onEnable: () => void | Promise<void>
  onLater: () => void | Promise<void>
  busy?: boolean
  error?: string | null
}

export default function NotificationOptInPrompt({
  vibe,
  onEnable,
  onLater,
  busy = false,
  error = null,
}: Props) {
  const tone = getToneLabel(vibe)
  const hasError = Boolean(error)

  return (
    <>
      <div className="overlay" style={{ zIndex: 120 }} />
      <div
        className="bottom-sheet"
        style={{ zIndex: 121 }}
        role="dialog"
        aria-labelledby="notify-opt-in-title"
      >
        <p className="circles-kicker text-indigo-muted mb-2">Daily nudge</p>
        <h3
          id="notify-opt-in-title"
          className="font-fraunces text-xl font-semibold text-ink mb-3"
        >
          Sarathy can nudge you to log expenses daily 🔔
        </h3>
        <p className="text-sm text-ink-3 leading-relaxed mb-6">
          It&apos;ll sound exactly like <span className="font-semibold text-ink">{tone}</span>.
          Want to turn it on?
        </p>

        {hasError && (
          <div className="bg-red-50 text-danger text-sm px-4 py-3 rounded-xl mb-4">
            Something went wrong — try again?
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => void onEnable()}
          >
            {busy ? 'Turning on…' : hasError ? 'Retry' : 'Yes please!'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => void onLater()}
          >
            Maybe later
          </button>
        </div>
      </div>
    </>
  )
}
