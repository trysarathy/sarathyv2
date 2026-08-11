'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { todayInSingapore } from '@/lib/sarathy/sgt'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'
import { CURRENCIES } from '@/components/ui/CurrencySelector'
import { friendlyExpenseSaveError } from '@/lib/booth/friendly-errors'
import { getAuthHeaders } from '@/lib/api-auth'
import { getDailyBudgetSnapshot } from '@/lib/nudge/daily-budget'
import PreSpendNudgeCard from '@/components/home/PreSpendNudgeCard'
import type { QuickLogChip } from '@/lib/expense/quick-log-chips'
import type { Profile } from '@/types'

interface Props {
  profile: Profile
  chip: QuickLogChip
  onClose: () => void
  onLogged: (xp: number, coords?: { x: number; y: number }) => void | Promise<void>
  todaySpent?: number
}

function xpFloatCoords(el: HTMLElement | null): { x: number; y: number } | undefined {
  if (!el) return undefined
  const rect = el.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top }
}

/** Minimal 2-tap quick log: amount only → Save. */
export default function QuickLogSheet({
  profile,
  chip,
  onClose,
  onLogged,
  todaySpent = 0,
}: Props) {
  const supabase = createClient()
  const currency = getProfileDisplayCurrency(profile)
  const currencyMeta = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0]

  const [amount, setAmount] = useState(chip.amount > 0 ? String(chip.amount) : '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [nudgeGate, setNudgeGate] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const saveButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const id = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 50)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    setNudgeGate(false)
  }, [amount])

  const pending = parseFloat(amount)
  const pendingPrimary = Number.isFinite(pending) && pending > 0 ? pending : 0
  const nudgeSnapshot =
    pendingPrimary > 0 && profile.planning_amount
      ? getDailyBudgetSnapshot({
          planningAmount: profile.planning_amount,
          todaySpent,
          pendingAmount: pendingPrimary,
        })
      : null

  const handleSave = async () => {
    const value = parseFloat(amount)
    if (!Number.isFinite(value) || value <= 0) return

    if (!nudgeGate && pendingPrimary > 0 && profile.planning_amount) {
      const preview = getDailyBudgetSnapshot({
        planningAmount: profile.planning_amount,
        todaySpent,
        pendingAmount: pendingPrimary,
      })
      if (preview.level === 'warn' || preview.level === 'over') {
        setNudgeGate(true)
        return
      }
    }

    setSaving(true)
    setSaveError('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setSaveError('You need to be signed in to log an expense.')
        return
      }

      const expenseDate = todayInSingapore()
      const row: Record<string, unknown> = {
        user_id: user.id,
        category: chip.category,
        subcategory: chip.subcategory || chip.label,
        amount: value,
        description: chip.subcategory || chip.label,
        entry_date: expenseDate,
        logged_via: 'quick',
      }

      let { error: insertError } = await supabase.from('budget_entries').insert(row)
      if (insertError && /subcategory/i.test(insertError.message)) {
        delete row.subcategory
        ;({ error: insertError } = await supabase.from('budget_entries').insert(row))
      }
      if (insertError) {
        setSaveError(friendlyExpenseSaveError(insertError.message))
        return
      }

      const xpAward = 10
      const { data: p, error: profileReadError } = await supabase
        .from('profiles')
        .select('total_xp')
        .eq('id', user.id)
        .single()

      if (!profileReadError) {
        await supabase
          .from('profiles')
          .update({ total_xp: (p?.total_xp || 0) + xpAward })
          .eq('id', user.id)
      }

      try {
        await fetch('/api/nudge/after-expense', {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({ entryDate: expenseDate }),
        })
      } catch (nudgeErr) {
        console.warn('Budget nudge failed:', nudgeErr)
      }

      await onLogged(xpAward, xpFloatCoords(saveButtonRef.current))
      onClose()
    } catch (err) {
      console.error(err)
      setSaveError('Something went wrong saving this expense. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const showWarning =
    nudgeGate &&
    nudgeSnapshot &&
    (nudgeSnapshot.level === 'warn' || nudgeSnapshot.level === 'over')

  return (
    <>
      <div className="circles-overlay" onClick={onClose} />
      <div
        className="log-sheet circles-enter-1"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        <div className="log-sheet-indigo-top" style={{ marginBottom: 16 }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="circles-kicker text-indigo-muted mb-1">Quick log</p>
              <h3 className="font-fraunces text-xl font-semibold text-ink-on-indigo">
                {chip.emoji} {chip.label}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-ink-on-indigo/50 text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="flex gap-2 items-center">
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.85)',
                minWidth: 28,
              }}
            >
              {currencyMeta.symbol}
            </span>
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleSave()
                }
              }}
              placeholder="0.00"
              className="log-sheet-amount flex-1"
              aria-label="Amount"
            />
          </div>
        </div>

        {saveError && (
          <div className="bg-red-50 text-danger text-sm px-3 py-2.5 rounded-xl mb-4">
            {saveError}
          </div>
        )}

        {nudgeSnapshot?.level === 'healthy' && (
          <PreSpendNudgeCard
            level="healthy"
            remaining={nudgeSnapshot.remaining}
            percentageRemaining={nudgeSnapshot.percentageRemaining}
            currency={currency}
            onLogAnyway={() => {}}
            onReconsider={onClose}
          />
        )}

        {showWarning && (
          <PreSpendNudgeCard
            level={nudgeSnapshot.level}
            remaining={nudgeSnapshot.remaining}
            percentageRemaining={nudgeSnapshot.percentageRemaining}
            currency={currency}
            onLogAnyway={() => void handleSave()}
            onReconsider={onClose}
          />
        )}

        {!showWarning && (
          <button
            type="button"
            ref={saveButtonRef}
            onClick={() => void handleSave()}
            className="log-sheet-save"
            disabled={saving || !amount || parseFloat(amount) <= 0}
          >
            {saving ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              `Save ${currencyMeta.symbol}${amount || '0'} →`
            )}
          </button>
        )}
      </div>
    </>
  )
}
