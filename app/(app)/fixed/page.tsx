'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { FixedSpending } from '@/types'
import { formatCurrency } from '@/lib/calculations'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'
import TabBar from '@/components/ui/TabBar'

export default function FixedCostsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [items, setItems] = useState<FixedSpending[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [currency, setCurrency] = useState('SGD')
  const [saveError, setSaveError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [emoji, setEmoji] = useState('💳')
  const [dueDay, setDueDay] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    const [fixedRes, profileRes] = await Promise.all([
      supabase.from('fixed_spending').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('profiles').select('primary_currency').eq('id', user.id).single(),
    ])
    setItems((fixedRes.data || []) as FixedSpending[])
    if (profileRes.data) {
      setCurrency(getProfileDisplayCurrency(profileRes.data as { primary_currency: string }))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!name.trim() || !amount) return
    setSaving(true)
    setSaveError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (editingId) {
      const { error } = await supabase.from('fixed_spending').update({
        name, amount: parseFloat(amount), emoji,
        due_day: dueDay ? parseInt(dueDay) : null,
      }).eq('id', editingId)
      if (error) {
        setSaveError(error.message)
        setSaving(false)
        return
      }
    } else {
      const { error } = await supabase.from('fixed_spending').insert({
        user_id: user.id, name, amount: parseFloat(amount), emoji,
        due_day: dueDay ? parseInt(dueDay) : null,
      })
      if (error) {
        setSaveError(error.message)
        setSaving(false)
        return
      }
    }

    setName(''); setAmount(''); setEmoji('💳')
    setDueDay(''); setEditingId(null)
    setShowAdd(false); setSaving(false)
    load()
  }

  const handleEdit = (item: FixedSpending) => {
    setName(item.name)
    setAmount(item.amount.toString())
    setEmoji(item.emoji)
    setDueDay(item.due_day?.toString() || '')
    setEditingId(item.id)
    setShowAdd(true)
  }

  const handleDelete = async (id: string) => {
    setSaveError(null)
    const { error } = await supabase.from('fixed_spending').delete().eq('id', id)
    if (error) {
      setSaveError(error.message)
      return
    }
    if (editingId === id) {
      setShowAdd(false)
      setEditingId(null)
    }
    load()
  }

  const handleToggle = async (item: FixedSpending) => {
    await supabase.from('fixed_spending')
      .update({ is_active: !item.is_active }).eq('id', item.id)
    load()
  }

  const total = items
    .filter(i => i.is_active)
    .reduce((sum, i) => sum + i.amount, 0)

  const EMOJIS = [
    '💳', '🏠', '📱', '💡', '🚗',
    '🎓', '💊', '🌐', '📺', '🎵', '🏋️', '🍔'
  ]

  if (loading) return (
    <div className="min-h-dvh bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-dvh bg-cream pb-24">
      <div className="px-5 pt-12 pb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-fraunces text-2xl font-semibold text-ink">
            Fixed costs
          </h1>
          <button
            onClick={() => {
              setShowAdd(true)
              setEditingId(null)
              setName(''); setAmount('')
              setEmoji('💳'); setDueDay('')
            }}
            className="w-9 h-9 bg-saffron rounded-full text-white text-xl flex items-center justify-center"
          >
            +
          </button>
        </div>
        <p className="text-ink-3 text-sm">
          Monthly total:{' '}
          <span className="font-semibold text-ink">
            {formatCurrency(total, currency)}
          </span>
        </p>
      </div>

      <div className="px-5">
        {items.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-3xl mb-3">💳</p>
            <p className="font-medium text-ink mb-1">No fixed costs yet</p>
            <p className="text-ink-3 text-sm">
              Add rent, subscriptions, phone bills —
              anything that repeats monthly.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map(item => (
              <div
                key={item.id}
                className={`card flex items-center gap-3 ${
                  !item.is_active ? 'opacity-50' : ''
                }`}
              >
                <span className="text-2xl">{item.emoji}</span>
                <div className="flex-1">
                  <p className="font-medium text-ink text-sm">{item.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-ink-3">
                      {formatCurrency(item.amount, currency)}/month
                    </span>
                    {item.due_day && (
                      <span className="text-xs text-ink-3">
                        · due {item.due_day}th
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="text-xs text-ink-3 px-2 py-1 rounded-lg bg-cream"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-xs text-danger px-2 py-1 rounded-lg bg-red-50"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => handleToggle(item)}
                    className={`w-10 h-6 rounded-full transition-colors ${
                      item.is_active ? 'bg-saffron' : 'bg-gray-200'
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${
                      item.is_active ? 'translate-x-4' : ''
                    }`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <>
          <div className="overlay" onClick={() => setShowAdd(false)} />
          <div className="bottom-sheet">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-fraunces text-xl font-semibold text-ink">
                {editingId ? 'Edit' : 'Add'} fixed cost
              </h3>
              <button
                onClick={() => setShowAdd(false)}
                className="text-ink-3 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`text-2xl w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${
                    emoji === e
                      ? 'bg-saffron-soft border-2 border-saffron'
                      : 'bg-cream'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Name (e.g. Rent, Spotify)"
              className="input-field mb-3"
            />

            <div className="flex gap-3 mb-3">
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Amount"
                className="input-field flex-1"
                inputMode="decimal"
              />
              <input
                type="number"
                value={dueDay}
                onChange={e => setDueDay(e.target.value)}
                placeholder="Due day"
                className="input-field w-28"
                inputMode="numeric"
                min="1"
                max="31"
              />
            </div>

            {saveError && (
              <p className="text-xs text-danger mb-3">{saveError}</p>
            )}

            <button
              onClick={handleSave}
              className="btn-primary"
              disabled={saving || !name || !amount}
            >
              {saving ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : editingId ? 'Save changes' : 'Add fixed cost'}
            </button>

            {editingId && (
              <button
                onClick={() => {
                  handleDelete(editingId)
                  setShowAdd(false)
                }}
                className="w-full mt-3 py-3 text-sm text-danger font-medium"
              >
                Delete this cost
              </button>
            )}
          </div>
        </>
      )}

      <TabBar active="profile" />
    </div>
  )
}