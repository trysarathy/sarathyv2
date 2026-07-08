'use client'

import { useCallback, useEffect, useState } from 'react'
import { markHomeWalkthroughDone } from '@/lib/booth/walkthrough-storage'

const STEPS = [
  {
    title: 'Your number',
    body: 'This is your safe-to-spend — one number that already protects your savings.',
  },
  {
    title: 'Log by voice',
    body: "Log expenses by talking — try 'spent 8 dollars on lunch'.",
  },
  {
    title: 'This month',
    body: 'See and edit everything here.',
  },
] as const

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

interface Props {
  heroRef: React.RefObject<HTMLElement>
  actionsRef: React.RefObject<HTMLElement>
  monthTileRef: React.RefObject<HTMLElement>
  onDone: () => void
}

function measure(ref: React.RefObject<HTMLElement>): Rect | null {
  const el = ref.current
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export default function HomeWalkthrough({ heroRef, actionsRef, monthTileRef, onDone }: Props) {
  const [step, setStep] = useState(0)
  const [spot, setSpot] = useState<Rect | null>(null)

  const dismiss = useCallback(() => {
    markHomeWalkthroughDone()
    onDone()
  }, [onDone])

  const updateSpot = useCallback(() => {
    const ref = step === 0 ? heroRef : step === 1 ? actionsRef : monthTileRef
    setSpot(measure(ref))
  }, [step, heroRef, actionsRef, monthTileRef])

  useEffect(() => {
    const ref = step === 0 ? heroRef : step === 1 ? actionsRef : monthTileRef
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    ref.current?.scrollIntoView({ behavior, block: 'center' })
    const t = window.setTimeout(updateSpot, step === 2 ? 320 : 120)
    window.addEventListener('resize', updateSpot)
    window.addEventListener('scroll', updateSpot, true)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('resize', updateSpot)
      window.removeEventListener('scroll', updateSpot, true)
    }
  }, [step, updateSpot, heroRef, actionsRef, monthTileRef])

  const pad = 8
  const highlight = spot
    ? {
        top: spot.top - pad,
        left: spot.left - pad,
        width: spot.width + pad * 2,
        height: spot.height + pad * 2,
      }
    : null

  const tooltipTop = highlight
    ? Math.min(highlight.top + highlight.height + 14, window.innerHeight - 200)
    : window.innerHeight * 0.35

  const current = STEPS[step]

  const handlePrimary = () => {
    if (step >= STEPS.length - 1) {
      dismiss()
    } else {
      setStep(s => s + 1)
    }
  }

  return (
    <div className="booth-walkthrough-root" role="dialog" aria-modal="true" aria-label="App tour">
      <button type="button" className="booth-walkthrough-backdrop" onClick={dismiss} aria-label="Skip tour" />

      {highlight && (
        <div
          className="booth-walkthrough-spotlight"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      )}

      <div
        className="booth-walkthrough-card"
        style={{ top: tooltipTop }}
      >
        <p className="booth-walkthrough-step">
          {step + 1} of {STEPS.length}
        </p>
        <h2 className="booth-walkthrough-title">{current.title}</h2>
        <p className="booth-walkthrough-body">{current.body}</p>
        <div className="booth-walkthrough-actions">
          <button type="button" className="booth-walkthrough-skip" onClick={dismiss}>
            Skip tour
          </button>
          <button type="button" className="booth-walkthrough-next" onClick={handlePrimary}>
            {step >= STEPS.length - 1 ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
