'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface Props {
  userId: string
  variant?: 'card' | 'inline'
  onLogged?: () => void
}

const MOODS = [
  { emoji: '😌', value: 'good' },
  { emoji: '😰', value: 'anxious' },
  { emoji: '😤', value: 'stressed' },
]

export default function MoodCheckIn({ userId, variant = 'card', onLogged }: Props) {
  const supabase = createClient()
  const [checking, setChecking] = useState(true)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const client = createClient()
    const today = new Date().toISOString().split('T')[0]
    client
      .from('mood_logs')
      .select('mood')
      .eq('user_id', userId)
      .eq('entry_date', today)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.mood) setDone(true)
        setChecking(false)
      })
  }, [userId])

  const handleMood = async (mood: string) => {
    await supabase.from('mood_logs').upsert(
      {
        user_id: userId,
        mood,
        entry_date: new Date().toISOString().split('T')[0],
      },
      { onConflict: 'user_id,entry_date' }
    )
    setDone(true)
    onLogged?.()
  }

  if (checking || done) return null

  if (variant === 'inline') {
    return (
      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3 pb-2 mb-2">
        <p className="text-xs text-indigo-muted shrink-0">Money mood today?</p>
        <div className="flex gap-2">
          {MOODS.map((mood) => (
            <button
              key={mood.value}
              type="button"
              onClick={() => handleMood(mood.value)}
              className="text-xl leading-none p-2 rounded-full bg-white/8 active:bg-white/15 transition-colors"
              aria-label={mood.value}
            >
              {mood.emoji}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-3">
        How are you feeling about money today?
      </p>
      <div className="flex gap-3">
        {MOODS.map((mood) => (
          <button
            key={mood.value}
            type="button"
            onClick={() => handleMood(mood.value)}
            className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl bg-cream active:bg-saffron-soft transition-colors"
          >
            <span className="text-2xl">{mood.emoji}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
