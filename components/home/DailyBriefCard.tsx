'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { getAuthHeaders } from '@/lib/api-auth'
import { friendlyBriefError } from '@/lib/booth/friendly-errors'

interface Props {
  firstName?: string
}

function BriefLetter({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-8 pl-4 border-l-2 border-white/15">
      {children}
    </div>
  )
}

export default function DailyBriefCard({ firstName }: Props) {
  const [brief, setBrief] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const attemptRef = useRef(0)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setLoadFailed(false)

      const supabase = createClient()
      let headers = await getAuthHeaders()

      if (!headers.Authorization && attemptRef.current < 5) {
        await new Promise(r => setTimeout(r, 200 * (attemptRef.current + 1)))
        attemptRef.current += 1
        headers = await getAuthHeaders()
      }

      try {
        const res = await fetch('/api/sarathy/daily-brief', { headers })

        if (res.status === 401 && attemptRef.current < 5) {
          attemptRef.current += 1
          await new Promise(r => setTimeout(r, 300))
          if (!cancelled) return load()
          return
        }

        const data = await res.json()
        if (cancelled) return

        if (!res.ok) {
          console.error('Daily brief API error:', data.error || res.status)
          setBrief(null)
          setLoadFailed(true)
          return
        }

        const text = typeof data.brief === 'string' && data.brief.trim() ? data.brief.trim() : null
        setBrief(text)
        if (!text) setLoadFailed(true)
      } catch (err) {
        if (!cancelled) {
          console.error('Daily brief fetch failed:', err)
          setBrief(null)
          setLoadFailed(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <BriefLetter>
        <div className="animate-pulse">
          <div className="h-3 bg-white/10 rounded w-3/4 mb-3" />
          <div className="h-3 bg-white/10 rounded w-full mb-2" />
          <div className="h-3 bg-white/10 rounded w-5/6 mb-4" />
          <div className="h-2 bg-white/10 rounded w-24" />
        </div>
      </BriefLetter>
    )
  }

  if (brief) {
    return (
      <BriefLetter>
        <p className="font-fraunces italic text-[17px] text-ink-on-indigo leading-[1.65] font-normal whitespace-pre-line">
          {brief}
        </p>
        <p className="font-fraunces italic text-[13px] text-indigo-muted mt-4">
          — Sarathy 🌸
        </p>
      </BriefLetter>
    )
  }

  if (firstName) {
    return (
      <BriefLetter>
        <p className="font-fraunces italic text-[17px] text-ink-on-indigo/75 leading-[1.65]">
          Hey {firstName} 👋
        </p>
        {loadFailed && (
          <>
            <p className="text-[13px] text-indigo-muted/90 mt-3 leading-relaxed">
              {friendlyBriefError()}
            </p>
            <p className="font-fraunces italic text-[13px] text-indigo-muted mt-3">
              — Sarathy 🌸
            </p>
          </>
        )}
      </BriefLetter>
    )
  }

  return null
}
