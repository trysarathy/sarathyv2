'use client'
import { useState } from 'react'
import {
  Bus,
  Check,
  ChevronDown,
  Clapperboard,
  GraduationCap,
  HeartHandshake,
  Home as HomeIcon,
  MoreHorizontal,
  Pill,
  Plus,
  ShoppingBag,
  Smile,
  Meh,
  Frown,
  Utensils,
  UsersRound,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { CURRENCIES } from '@/components/ui/CurrencySelector'
import { Profile } from '@/types'
import { getLocalDateKey } from '@/lib/dates'

interface Props {
  profile: Profile
  onClose: () => void
  onLogged: (xp: number, x: number, y: number) => void
}

const CATEGORIES: Array<{ icon: LucideIcon; label: string; value: string }> = [
  { icon: Utensils, label: 'Food', value: 'Food' },
  { icon: Bus, label: 'Transport', value: 'Transport' },
  { icon: UsersRound, label: 'Social', value: 'Social' },
  { icon: HomeIcon, label: 'Home', value: 'Home' },
  { icon: HeartHandshake, label: 'Family', value: 'Family' },
  { icon: ShoppingBag, label: 'Shopping', value: 'Shopping' },
  { icon: Pill, label: 'Health', value: 'Health' },
  { icon: GraduationCap, label: 'Education', value: 'Education' },
  { icon: Clapperboard, label: 'Entertainment', value: 'Entertainment' },
  { icon: MoreHorizontal, label: 'Other', value: 'Other' },
]

const MOODS: Array<{ icon: LucideIcon; label: string; value: string; tone: string }> = [
  { icon: Smile, label: 'Good', value: 'good', tone: 'text-safe' },
  { icon: Meh, label: 'Anxious', value: 'anxious', tone: 'text-warning' },
  { icon: Frown, label: 'Stressed', value: 'stressed', tone: 'text-danger' },
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
  const [error, setError] = useState('')

  const selectedCurrency = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0]
  const profileCurrencyData = CURRENCIES.find(c => c.code === profileCurrency) || CURRENCIES[0]
  const amountValue = Number(amount)
  const canSave = Number.isFinite(amountValue) && amountValue > 0

  const handleSave = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!canSave) return
    const rect = e.currentTarget.getBoundingClientRect()
    setSaving(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let finalAmount = amountValue
      const originalAmount = finalAmount
      const originalCurrency = currency
      const today = getLocalDateKey()

      if (currency !== profileCurrency) {
        try {
          const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${currency}`)
          if (!res.ok) throw new Error('Failed to fetch exchange rate')
          const data = await res.json()
          const rate = data.rates?.[profileCurrency]
          if (!rate) throw new Error('Missing exchange rate')
          finalAmount = parseFloat((amountValue * rate).toFixed(2))
        } catch {
          setError(`Could not convert ${currency} to ${profileCurrency}. Try again or switch to ${profileCurrency}.`)
          return
        }
      }

      if (mood) {
        await supabase.from('mood_logs').upsert({
          user_id: user.id,
          mood,
          entry_date: today,
        }, { onConflict: 'user_id,entry_date' })
      }

      const { error: insertError } = await supabase.from('budget_entries').insert({
        user_id: user.id,
        category,
        amount: finalAmount,
        original_amount: originalAmount,
        original_currency: originalCurrency,
        description: description || category,
        entry_date: today,
        logged_via: 'manual',
      })
      if (insertError) throw insertError

      const { data: p } = await supabase.from('profiles').select('total_xp').eq('id', user.id).single()
      await supabase.from('profiles').update({ total_xp: (p?.total_xp || 0) + 10 }).eq('id', user.id)

      onLogged(10, rect.left + rect.width / 2, rect.top)
      onClose()
    } catch (err) {
      console.error(err)
      setError('Could not save this expense. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="bottom-sheet max-h-[88dvh] overflow-y-auto">
        <div className="sheet-handle" />
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="font-fraunces text-2xl font-semibold text-ink">Log expense</h3>
            <p className="text-xs text-ink-3">Add it now, understand it later.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-3"
            aria-label="Close log expense sheet"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 rounded-2xl border border-line bg-cream/60 p-3">
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
              className="flex flex-shrink-0 items-center gap-2 rounded-xl border border-line bg-white px-3 py-3 text-sm font-semibold text-ink"
              aria-expanded={showCurrencyPicker}
            >
              {selectedCurrency.code}
              <ChevronDown className={`h-4 w-4 text-ink-3 transition-transform ${showCurrencyPicker ? 'rotate-180' : ''}`} />
            </button>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="input-field flex-1 border-0 bg-white text-3xl font-semibold"
              inputMode="decimal"
              autoFocus
            />
          </div>

          {showCurrencyPicker && (
            <div className="mb-2 max-h-48 overflow-y-auto rounded-2xl border border-line bg-white shadow-lg">
              {CURRENCIES.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => { setCurrency(c.code); setShowCurrencyPicker(false) }}
                  className={`flex w-full items-center gap-3 border-b border-cream px-4 py-2.5 text-left last:border-0 ${
                    currency === c.code ? 'bg-saffron-soft' : 'hover:bg-cream'
                  }`}
                >
                  <span className="w-10 text-sm font-bold text-ink">{c.code}</span>
                  <span className="flex-1 text-xs text-ink-3">{c.name}</span>
                  {currency === c.code && <Check className="h-4 w-4 text-saffron" />}
                </button>
              ))}
            </div>
          )}

          {currency !== profileCurrency && canSave && (
            <div className="rounded-xl bg-mint px-3 py-2">
              <p className="text-xs text-ink-3">
                Converts to {profileCurrencyData.code} at a live rate before it is added to your budget.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-danger" role="alert">
              {error}
            </div>
          )}
        </div>

        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What was this for? (optional)"
          className="input-field mb-4"
        />

        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Category</p>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon
              const selected = category === cat.value

              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  aria-pressed={selected}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left transition-colors ${
                    selected
                      ? 'border-saffron bg-saffron-soft text-saffron'
                      : 'border-line bg-white text-ink hover:bg-cream'
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs font-semibold">{cat.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
            Money mood (optional)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {MOODS.map(item => {
              const Icon = item.icon
              const selected = mood === item.value

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setMood(selected ? '' : item.value)}
                  aria-pressed={selected}
                  className={`flex flex-col items-center gap-1 rounded-xl border py-3 transition-colors ${
                    selected ? 'border-saffron bg-saffron-soft' : 'border-line bg-white'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${item.tone}`} />
                  <span className="text-xs font-medium text-ink-3">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="btn-primary"
          disabled={saving || !canSave}
        >
          {saving ? (
            <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <>
              <Plus className="h-5 w-5" />
              Log {selectedCurrency.symbol}{amount || '0'}
            </>
          )}
        </button>
      </div>
    </>
  )
}
