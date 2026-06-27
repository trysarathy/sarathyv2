'use client'
import { useState } from 'react'
import { CheckCircle2, Frown, Meh, Smile } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { getLocalDateKey } from '@/lib/dates'

interface Props {
  userId: string
  onLogged?: () => void
}

const MOODS: Array<{ icon: LucideIcon; label: string; value: string; tone: string }> = [
  { icon: Smile, label: 'Good', value: 'good', tone: 'text-safe' },
  { icon: Meh, label: 'Anxious', value: 'anxious', tone: 'text-warning' },
  { icon: Frown, label: 'Stressed', value: 'stressed', tone: 'text-danger' },
]

export default function MoodCheckIn({ userId, onLogged }: Props) {
  const supabase = createClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const handleMood = async (mood: string) => {
    if (saving) return
    setSelected(mood)
    setSaveError('')
    setSaving(true)
    try {
      const { error } = await supabase.from('mood_logs').upsert({
        user_id: userId,
        mood,
        entry_date: getLocalDateKey(),
      }, { onConflict: 'user_id,entry_date' })
      if (error) throw error
      setSaved(true)
      setTimeout(() => onLogged?.(), 800)
    } catch (err) {
      console.error('Failed to save mood:', err)
      setSelected(null)
      setSaveError("Couldn't save that mood. Try again.")
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    const loggedMood = MOODS.find(m => m.value === selected)
    const Icon = loggedMood?.icon || CheckCircle2

    return (
      <div className="card flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint text-safe">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Mood logged</p>
          <p className="text-xs text-ink-3">Sarathy will keep this in mind today.</p>
        </div>
      </div>
    )
  }

  return (
    <section className="card" aria-labelledby="mood-check-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p id="mood-check-title" className="text-sm font-semibold text-ink">
            How are you feeling about money today?
          </p>
          <p className="text-xs text-ink-3">This tunes Sarathy's advice.</p>
        </div>
      </div>
      {saveError && (
        <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-danger" role="alert">
          {saveError}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {MOODS.map(mood => {
          const Icon = mood.icon

          return (
            <button
              key={mood.value}
              type="button"
              onClick={() => handleMood(mood.value)}
              disabled={saving}
              aria-busy={saving && selected === mood.value}
              className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-line bg-white py-3 transition-colors active:bg-saffron-soft"
            >
              <Icon className={`h-6 w-6 ${mood.tone}`} />
              <span className="text-xs font-medium text-ink-3">{mood.label}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
