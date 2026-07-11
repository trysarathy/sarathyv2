'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  FEEDBACK_ACTIVE_MS,
  getFeedbackActiveMs,
  isFeedbackPromptDone,
  markFeedbackPromptDone,
  setFeedbackActiveMs,
} from '@/lib/booth/feedback-storage'

const RATINGS = ['Love it', 'Getting there', 'Confused'] as const
type Rating = (typeof RATINGS)[number]

export default function FeedbackPrompt() {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState<Rating | null>(null)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(true)

  const accumulatedRef = useRef(0)
  const lastTickRef = useRef<number | null>(null)
  const shownRef = useRef(false)

  useEffect(() => {
    setDone(isFeedbackPromptDone())
    accumulatedRef.current = getFeedbackActiveMs()
  }, [])

  const tryShow = useCallback(() => {
    if (shownRef.current || isFeedbackPromptDone()) return
    if (accumulatedRef.current < FEEDBACK_ACTIVE_MS) return
    shownRef.current = true
    setOpen(true)
  }, [])

  useEffect(() => {
    if (done) return

    const tick = () => {
      if (document.visibilityState !== 'visible') {
        lastTickRef.current = null
        return
      }
      const now = Date.now()
      if (lastTickRef.current != null) {
        accumulatedRef.current += now - lastTickRef.current
        setFeedbackActiveMs(accumulatedRef.current)
        tryShow()
      }
      lastTickRef.current = now
    }

    lastTickRef.current =
      document.visibilityState === 'visible' ? Date.now() : null

    const interval = window.setInterval(tick, 1000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastTickRef.current = Date.now()
      } else {
        tick()
        lastTickRef.current = null
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    tryShow()

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      if (document.visibilityState === 'visible' && lastTickRef.current != null) {
        accumulatedRef.current += Date.now() - lastTickRef.current
        setFeedbackActiveMs(accumulatedRef.current)
      }
    }
  }, [done, tryShow])

  const dismiss = () => {
    markFeedbackPromptDone()
    setDone(true)
    setOpen(false)
  }

  const handleSubmit = async () => {
    if (!rating) return
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Please sign in again to send feedback.')
        setSaving(false)
        return
      }

      const { error: insertError } = await supabase.from('user_feedback').insert({
        user_id: user.id,
        rating,
        comment: comment.trim() || null,
      })

      if (insertError) {
        setError(insertError.message)
        setSaving(false)
        return
      }

      markFeedbackPromptDone()
      setDone(true)
      setOpen(false)
    } catch {
      setError('Could not save feedback. Try again.')
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className="overlay" onClick={dismiss} />
      <div
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-prompt-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="feedback-prompt-title" className="font-fraunces text-xl font-semibold text-ink">
            How&apos;s Sarathy feeling so far?
          </h3>
          <button type="button" onClick={dismiss} className="text-ink-3 text-2xl leading-none" aria-label="Close">
            ×
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          {RATINGS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRating(option)}
              className={`w-full text-left px-4 py-3.5 rounded-xl border-2 text-sm font-medium transition-all ${
                rating === option
                  ? 'border-saffron bg-saffron-soft text-ink'
                  : 'border-transparent bg-cream text-ink'
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {rating && (
          <div className="flex flex-col gap-3">
            <label className="text-sm text-ink-3" htmlFor="feedback-comment">
              Tell us more (optional)
            </label>
            <textarea
              id="feedback-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Anything we should know…"
              rows={3}
              className="input-field resize-none"
              autoFocus
            />
            {error && <p className="text-xs text-danger">{error}</p>}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Send feedback'
              )}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
