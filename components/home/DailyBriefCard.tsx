'use client'

import { useEffect, useState } from 'react'
import { getAuthHeaders } from '@/lib/api-auth'

interface Props {
  /** Hide the plain "Hey {name}" header when the brief is showing. */
  onBriefLoaded?: (hasBrief: boolean) => void
}

export default function DailyBriefCard({ onBriefLoaded }: Props) {
  const [brief, setBrief] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch('/api/sarathy/daily-brief', {
          headers: await getAuthHeaders(),
        })
        const data = await res.json()
        if (cancelled) return
        const text = typeof data.brief === 'string' && data.brief.trim() ? data.brief.trim() : null
        setBrief(text)
        onBriefLoaded?.(Boolean(text))
      } catch {
        if (!cancelled) {
          setBrief(null)
          onBriefLoaded?.(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [onBriefLoaded])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4 animate-pulse">
        <div className="h-3 bg-cream-3 rounded w-3/4 mb-3" />
        <div className="h-3 bg-cream-3 rounded w-full mb-2" />
        <div className="h-3 bg-cream-3 rounded w-5/6" />
      </div>
    )
  }

  if (!brief) return null

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
      <div className="flex gap-2 items-start">
        <span className="text-lg flex-shrink-0 mt-0.5">🌸</span>
        <p className="font-fraunces text-base font-medium text-ink leading-relaxed">{brief}</p>
      </div>
    </div>
  )
}
