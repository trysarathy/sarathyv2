'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency, getCategoryEmoji } from '@/lib/calculations'
import type { PLCategory, Profile } from '@/types'

interface Props {
  profile: Profile
  categories: PLCategory[]
  monthTotal: number
  currency: string
  onSelectCategory: (cat: PLCategory) => void
  onClose: () => void
  onBudgetUpdated?: (planningAmount: number | null) => void
}

export default function MonthSummarySheet({
  profile,
  categories,
  monthTotal,
  currency,
  onSelectCategory,
  onClose,
  onBudgetUpdated,
}: Props) {
  const supabase = createClient()
  const [budget, setBudget] = useState(profile.planning_amount ?? 0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [toast, setToast] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setBudget(profile.planning_amount ?? 0)
  }, [profile.planning_amount])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(false), 2000)
    return () => window.clearTimeout(t)
  }, [toast])

  const hasBudget = budget > 0
  const remaining = Math.max(0, budget - monthTotal)
  const progressPercent = hasBudget
    ? Math.min(100, Math.round((monthTotal / budget) * 100))
    : 0
  const hasExpenses = categories.length > 0 || monthTotal > 0

  const startEdit = () => {
    setDraft(budget > 0 ? String(budget) : '')
    setSaveError(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setSaveError(null)
    setDraft(budget > 0 ? String(budget) : '')
  }

  const handleSave = async () => {
    const parsed = Math.max(0, Math.round(parseFloat(draft) || 0))
    setSaving(true)
    setSaveError(null)
    const { error } = await supabase
      .from('profiles')
      .update({ planning_amount: parsed || null })
      .eq('id', profile.id)
    setSaving(false)
    if (error) {
      setSaveError(error.message)
      return
    }
    setBudget(parsed)
    setEditing(false)
    setToast(true)
    onBudgetUpdated?.(parsed || null)
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="bottom-sheet max-h-[85dvh] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h3 className="font-fraunces text-lg font-semibold text-ink">This month</h3>
            <p className="text-ink-3 text-xs">Tap a category for details</p>
          </div>
          <button type="button" onClick={onClose} className="text-ink-3 text-2xl leading-none">
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          <div className="mb-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide">
                Income / Budget
              </p>
              {!editing && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="flex items-center gap-1.5 text-sm font-semibold text-ink active:opacity-70"
                  aria-label="Edit income or budget"
                >
                  <span>
                    {hasBudget ? formatCurrency(budget, currency) : 'Set amount'}
                  </span>
                  <span aria-hidden>✏️</span>
                </button>
              )}
            </div>

            {editing ? (
              <div className="flex flex-col gap-2 mb-4">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="number"
                    min="0"
                    step="1"
                    inputMode="decimal"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Monthly budget"
                    className="input-field flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary !w-auto px-5 shrink-0"
                  >
                    {saving ? '…' : 'Save'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-xs text-ink-3 self-start"
                >
                  Cancel
                </button>
                {saveError && <p className="text-xs text-danger">{saveError}</p>}
              </div>
            ) : null}

            {hasBudget && (
              <>
                <p className="text-sm font-medium text-ink mb-3">
                  {formatCurrency(monthTotal, currency)} spent out of{' '}
                  {formatCurrency(budget, currency)} this month
                </p>

                <div
                  className="h-2.5 rounded-full bg-[#F0E8DC] overflow-hidden mb-3"
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Monthly spending progress"
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{
                      width: `${progressPercent}%`,
                      background: '#D4A853',
                    }}
                  />
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-semibold text-[#C45C4A]">
                      {formatCurrency(monthTotal, currency)} spent
                    </p>
                  </div>
                  <div className="min-w-0 text-center">
                    <p className="text-sm font-semibold text-safe">
                      {formatCurrency(remaining, currency)} left
                    </p>
                  </div>
                  <div className="min-w-0 text-right">
                    <button
                      type="button"
                      onClick={startEdit}
                      className="text-sm font-medium text-ink-3 active:opacity-70"
                    >
                      {formatCurrency(budget, currency)} budget
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {!hasExpenses ? (
            <p className="py-6 text-center text-ink-3 text-sm leading-relaxed">
              Log your first expense to start tracking
            </p>
          ) : (
            <div className="border-t border-cream pt-1">
              {categories.map((cat) => (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => onSelectCategory(cat)}
                  className="w-full flex items-center justify-between py-3 border-b border-cream last:border-0 active:bg-cream transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span>{getCategoryEmoji(cat.category)}</span>
                    <span className="text-sm font-medium text-ink">{cat.category}</span>
                    <span className="text-xs text-ink-3">{cat.percentage}%</span>
                  </div>
                  <span className="text-sm font-medium text-ink">
                    {formatCurrency(cat.total, currency)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="booth-toast" role="status">
          Budget updated ✓
        </div>
      )}
    </>
  )
}
