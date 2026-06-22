'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'

interface Props {
  userId: string
  onLogged?: () => void
}

const MOODS = [
  { emoji: '😌', label: 'Good', value: 'good' },
  { emoji: '😰', label: 'Anxious', value: 'anxious' },
  { emoji: '😤', label: 'Stressed', value: 'stressed' },
]

export default function MoodCheckIn({ userId, onLogged }: Props) {
  const supabase = createClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handleMood = async (mood: string) => {
    setSelected(mood)
    await supabase.from('mood_logs').upsert({
      user_id: userId,
      mood,
      entry_date: new Date().toISOString().split('T')[0],
    }, { onConflict: 'user_id,entry_date' })
    setSaved(true)
    setTimeout(() => onLogged?.(), 800)
  }

  if (saved) return (
    <div className="card text-center py-4">
      <p className="text-2xl mb-1">
        {MOODS.find(m => m.value === selected)?.emoji}
      </p>
      <p className="text-sm text-ink-3">
        Logged — Sarathy will keep this in mind 🌸
      </p>
    </div>
  )

  return (
    <div className="card">
      <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-3">
        How are you feeling about money today?
      </p>
      <div className="flex gap-3">
        {MOODS.map(mood => (
          <button
            key={mood.value}
            onClick={() => handleMood(mood.value)}
            className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl bg-cream active:bg-saffron-soft transition-colors"
          >
            <span className="text-2xl">{mood.emoji}</span>
            <span className="text-xs text-ink-3">{mood.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
