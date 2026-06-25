'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/calculations'
import { CURRENCIES } from '@/components/ui/CurrencySelector'
import { Profile } from '@/types'

interface Props {
  profile: Profile
  onClose: () => void
  onLogged: (xp: number, x: number, y: number) => void
}

const CATEGORIES = [
  { emoji: '🍔', label: 'Food', value: 'Food' },
  { emoji: '��', label: 'Transport', value: 'Transport' },
  { emoji: '👥', label: 'Social', value: 'Social' },
  { emoji: '🏠', label: 'Home', value: 'Home' },
  { emoji: '❤️', label: 'Family', value: 'Family' },
  { emoji: '🛍️', label: 'Shopping', value: 'Shopping' },
  { emoji: '💊', label: 'Health', value: 'Health' },
  { emoji: '🎓', label: 'Education', value: 'Education' },
  { emoji: '🎬', label: 'Entertainment', value: 'Entertainment' },
  { emoji: '📌', label: 'Other', value: 'Other' },
]

const MOODS = [
  { emoji: '😌', label: 'Good', value: 'good' },
  { emoji: '😰', label: 'Anxious', value: 'anxious' },
  { emoji: '😤', label: 'Stressed', value: 'stressed' },
]

export default function LogExpenseSheet({ profile, onClose, onLogged }: Props) {
  const supabase = createClient()
  const profileCurrency = profile.primary_currency || 'SGD'

  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food')
  const [description, setDescription] = useState('')
  const [mood, setMood] = useState('')
  const [saving, setSaving] = useState(false)
  const [currency, setCurrency] = useState(profileCurrency)
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)

  const selectedCurrency = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0]
  const profileCurrencyData = CURRENCIES.find(c => c.code === profileCurrency) || CURRENCIES[0]

  const handleSave = async (e: React.MouseEvent) => {
    if (!amount || parseFloat(amount) <= 0) return
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let finalAmount = parseFloat(amount)
      let originalAmount = finalAmount
      let originalCurrency = currency

      // If logging in a different currency, convert to profile currency
      if (currency !== profileCurrency) {
        try {
          const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${currency}`)
          const data = await res.json()
          const rate = data.rates?.[profileCurrency]
          if (rate) {
            finalAmount = parseFloat((parseFloat(amount) * rate).toFixed(2))
          }
        } catch {
          // Use as-is if conversion fails
        }
      }

      // Log mood if selected
      if (mood) {
        await supabase.from('mood_logs').upsert({
          user_id: user.id,
          mood,
          entry_date: new Date().toISOString().split('T')[0],
        }, { onConflict: 'user_id,entry_date' })
      }

      // Log expense
      await supabase.from('budget_entries').insert({
        user_id: user.id,
        category,
        amount: finalAmount,
        original_amount: originalAmount,
        original_currency: originalCurrency,
        description: description || category,
        entry_date: new Date().toISOString().split('T')[0],
        logged_via: 'manual',
      })

      // Award XP
      const { data: p } = await supabase.from('profiles').select('total_xp').eq('id', user.id).single()
      await supabase.from('profiles').update({ total_xp: (p?.total_xp || 0) + 10 }).eq('id', user.id)

      const rect = (e.target as HTMLElement).getBoundingClientRect()
      onLogged(10, rect.left + rect.width / 2, rect.top)
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="bottom-sheet max-h-[85dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-fraunces text-xl font-semibold text-ink">Log expense</h3>
          <button onClick={onClose} className="text-ink-3 text-2xl">×</button>
        </div>

        {/* Amount + Currency */}
        <div className="mb-4">
          <div className="flex gap-2 items-center mb-2">
            <button
              onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-cream rounded-xl border-2 border-transparent active:border-saffron transition-colors flex-shrink-0"
            >
              <span className="text-lg">{selectedCurrency.flag}</span>
              <span className="font-semibold text-ink text-sm">{selectedCurrency.code}</span>
              <span className="text-ink-3 text-xs">▾</span>
            </button>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="input-field flex-1 text-2xl font-fraunces"
              inputMode="decimal"
              autoFocus
            />
          </div>

          {/* Currency picker dropdown */}
          {showCurrencyPicker && (
            <div className="bg-white rounded-2xl border border-cream-3 shadow-lg max-h-48 overflow-y-auto mb-2">
              {CURRENCIES.map(c => (
                <button
                  key={c.code}
                  onClick={() => { setCurrency(c.code); setShowCurrencyPicker(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-cream last:border-0 transition-colors ${
                    currency === c.code ? 'bg-saffron-soft' : 'hover:bg-cream'
                  }`}
                >
                  <span className="text-lg">{c.flag}</span>
                  <span className="font-medium text-ink text-sm">{c.code}</span>
                  <span className="text-xs text-ink-3">{c.name}</span>
                  {currency === c.code && <span className="ml-auto text-saffron text-sm">✓</span>}
                </button>
              ))}
            </div>
          )}

          {/* Conversion notice */}
          {currency !== profileCurrency && amount && parseFloat(amount) > 0 && (
            <div className="bg-saffron-soft rounded-xl px-3 py-2 mt-1">
              <p className="text-xs text-ink-3">
                Will be converted to {profileCurrencyData.code} {profileCurrencyData.symbol} at live rate and added to your budget
              </p>
            </div>
          )}
        </div>

        {/* Description */}
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What was this for? (optional)"
          className="input-field mb-4"
        />

        {/* Category */}
        <div className="mb-4">
          <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2">Category</p>
          <div className="grid grid-cols-5 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                  category === cat.value
                    ? 'bg-saffron text-white'
                    : 'bg-cream text-ink'
                }`}
              >
                <span className="text-lg">{cat.emoji}</span>
                <span className="text-[10px] font-medium">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mood */}
        <div className="mb-5">
          <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2">
            How are you feeling? (optional)
          </p>
          <div className="flex gap-2">
            {MOODS.map(m => (
              <button
                key={m.value}
                onClick={() => setMood(mood === m.value ? '' : m.value)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors ${
                  mood === m.value ? 'bg-saffron text-white' : 'bg-cream text-ink'
                }`}
              >
                <span className="text-xl">{m.emoji}</span>
                <span className="text-xs">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          className="btn-primary"
          disabled={saving || !amount || parseFloat(amount) <= 0}
        >
          {saving
            ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : `Log ${selectedCurrency.symbol}${amount || '0'} →`}
        </button>
      </div>
    </>
  )
}
