'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/calculations'
import type { Profile } from '@/types'

interface Props {
  profile: Profile
  monthTotal: number
  currency: string
  onBudgetUpdated?: (planningAmount: number | null) => void
  onLogFirstExpense?: () => void
}

export default function ThisMonthCard({
  profile,
  monthTotal,
  currency,
  onBudgetUpdated,
  onLogFirstExpense,
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
  const hasExpenses = monthTotal > 0

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
      <div
        id="this-month-card"
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8DFC8',
          borderRadius: 12,
          padding: '14px 14px 12px',
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#8A5E10',
            marginBottom: 10,
          }}
        >
          This month
        </p>

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
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
              style={{
                background: 'none',
                border: 'none',
                fontSize: 11,
                color: '#A09080',
                cursor: 'pointer',
                padding: 0,
                alignSelf: 'flex-start',
              }}
            >
              Cancel
            </button>
            {saveError && <p className="text-xs text-danger">{saveError}</p>}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 4,
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1C0F3F' }}>
              {formatCurrency(monthTotal, currency)} spent out of{' '}
            </span>
            <button
              type="button"
              onClick={startEdit}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 14,
                fontWeight: 600,
                color: '#1C0F3F',
              }}
              aria-label="Edit budget"
            >
              <span>
                {hasBudget ? `${formatCurrency(budget, currency)} budget` : 'Set budget'}
              </span>
              <span aria-hidden>✏️</span>
            </button>
          </div>
        )}

        <div
          style={{
            height: 10,
            borderRadius: 999,
            background: '#F0E8DC',
            overflow: 'hidden',
            marginBottom: 12,
          }}
          role="progressbar"
          aria-valuenow={hasExpenses ? progressPercent : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Monthly spending progress"
        >
          <div
            style={{
              height: '100%',
              width: `${hasExpenses ? progressPercent : 0}%`,
              borderRadius: 999,
              background: '#D4A853',
              transition: 'width 0.5s ease',
            }}
          />
        </div>

        {!hasExpenses ? (
          <button
            type="button"
            onClick={onLogFirstExpense}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 13,
              color: '#7A6E5A',
              cursor: onLogFirstExpense ? 'pointer' : 'default',
              textAlign: 'left',
            }}
          >
            Log your first expense to start tracking →
          </button>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#C45C4A' }}>
              {formatCurrency(monthTotal, currency)} spent
            </p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#10B981' }}>
              {formatCurrency(remaining, currency)} left
            </p>
            <button
              type="button"
              onClick={startEdit}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                margin: 0,
                fontSize: 12,
                fontWeight: 500,
                color: '#A09080',
                cursor: 'pointer',
              }}
            >
              {formatCurrency(budget, currency)} budget
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div className="booth-toast" role="status">
          Budget updated ✓
        </div>
      )}
    </>
  )
}
