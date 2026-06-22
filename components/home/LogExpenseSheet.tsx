'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Profile } from '@/types'
import { formatCurrency } from '@/lib/calculations'

const CATEGORIES = [
  { name: 'Food', emoji: '🍔' },
  { name: 'Transport', emoji: '🚕' },
  { name: 'Social', emoji: '👥' },
  { name: 'Home', emoji: '🏠' },
  { name: 'Family', emoji: '❤️' },
  { name: 'Shopping', emoji: '🛍️' },
  { name: 'Health', emoji: '💊' },
  { name: 'Other', emoji: '📌' },
]

interface Props {
  profile: Profile
  onClose: () => void
  onLogged: (xp: number, x: number, y: number) => void
}

export default function LogExpenseSheet({ profile, onClose, onLogged }: Props) {
  const supabase = createClient()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Food')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter an amount')
      return
    }
    setSaving(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const { error: insertError } = await supabase
        .from('budget_entries')
        .insert({
          user_id: user.id,
          category,
          amount: parseFloat(amount),
          description: description || null,
          entry_date: new Date().toISOString().split('T')[0],
          logged_via: 'manual',
        })

      if (insertError) throw insertError

      // Award XP
      await supabase
        .from('profiles')
        .update({ total_xp: (profile.total_xp || 0) + 10 })
        .eq('id', user.id)

      const rect = e.currentTarget.getBoundingClientRect()
      onLogged(10, rect.left + rect.width / 2, rect.top - 20)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Could not save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="bottom-sheet">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-fraunces text-xl font-semibold text-ink">What did you spend on?</h3>
          <button onClick={onClose} className="text-ink-3 text-2xl w-8 h-8 flex items-center justify-center">×</button>
        </div>

        {/* Amount */}
        <div className="text-center mb-5">
          <div className="flex items-center justify-center gap-2">
            <span className="text-ink-3 text-2xl font-fraunces">{profile.primary_currency === 'INR' ? '₹' : 'S$'}</span>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="text-5xl font-fraunces font-semibold text-ink bg-transparent border-none outline-none w-40 text-center"
              autoFocus
              inputMode="decimal"
            />
          </div>
        </div>

        {/* Description */}
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What was it? (your words)"
          className="input-field mb-4"
        />

        {/* Categories */}
        <div>
          <p className="text-xs font-medium text-ink-3 mb-2">Which line does this fit?</p>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {CATEGORIES.map(cat => (
              <button
                key={cat.name}
                onClick={() => setCategory(cat.name)}
                className={`category-chip flex-shrink-0 flex flex-col items-center gap-1 px-4 py-2 ${
                  category === cat.name ? 'selected' : ''
                }`}
              >
                <span className="text-xl">{cat.emoji}</span>
                <span className="text-xs">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-3 bg-red-50 text-danger text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <button
          onClick={handleSave}
          className="btn-primary mt-5"
          disabled={saving || !amount}
        >
          {saving ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : `Save ${amount ? formatCurrency(parseFloat(amount), profile.primary_currency || 'SGD') : ''}`}
        </button>
      </div>
    </>
  )
}
