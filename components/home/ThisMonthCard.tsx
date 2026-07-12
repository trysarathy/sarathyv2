'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/calculations'
import { todayInSingapore } from '@/lib/sarathy/sgt'
import type { Profile } from '@/types'

interface Props {
  profile: Profile
  monthTotal: number
  currency: string
  onBudgetUpdated?: (planningAmount: number | null) => void
  onLogFirstExpense?: () => void
  onOpenDetails?: () => void
}

function formatPlain(amount: number, currency: string): string {
  if (currency === 'INR') {
    return amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })
  }
  if (currency === 'SGD' || currency === 'USD' || currency === 'GBP' || currency === 'AUD') {
    return amount.toLocaleString('en-SG', { maximumFractionDigits: 0 })
  }
  return amount.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export default function ThisMonthCard({
  profile,
  monthTotal,
  currency,
  onBudgetUpdated,
  onLogFirstExpense,
  onOpenDetails,
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
  const monthLabel = new Date(`${todayInSingapore()}T12:00:00`).toLocaleDateString('en-US', {
    month: 'long',
  })

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
        <button
          type="button"
          onClick={onOpenDetails}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#8A5E10',
            marginBottom: 10,
            cursor: onOpenDetails ? 'pointer' : 'default',
            textAlign: 'left',
          }}
        >
          This month
        </button>

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
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                flexWrap: 'wrap',
                gap: 6,
                lineHeight: 1.1,
              }}
            >
              <span
                style={{
                  fontFamily: 'Fraunces, serif',
                  fontSize: 32,
                  fontWeight: 600,
                  color: '#1C0F3F',
                  letterSpacing: '-0.03em',
                }}
              >
                {formatPlain(monthTotal, currency)}
                <span style={{ color: '#A09080', fontWeight: 500 }}> / </span>
                {hasBudget ? formatPlain(budget, currency) : '—'}
              </span>
              <button
                type="button"
                onClick={startEdit}
                aria-label="Edit budget"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ✏️
              </button>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#A09080' }}>
                · {monthLabel}
              </span>
            </div>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 12,
                color: '#7A6E5A',
                fontWeight: 500,
              }}
            >
              spent / budget · {monthLabel}
            </p>
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
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#C45C4A' }}>
              {formatCurrency(monthTotal, currency)} spent
            </p>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#10B981' }}>
              {formatCurrency(remaining, currency)} left
            </p>
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
