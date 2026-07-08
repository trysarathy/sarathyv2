'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/calculations'
import { claimCircleSplit, createCircleSplit } from '@/lib/circles/client'
import { shareForUser } from '@/lib/circles/split-expense'
import { EXPENSE_CATEGORIES } from '@/lib/expense/categories'
import type { CircleMemberWithProfile, CircleMoment, ExpenseSplitContent } from '@/types'

interface Props {
  circleId: string
  members: CircleMemberWithProfile[]
  currentUserId: string
  currency: string
  onClose: () => void
  onComplete: () => void
}

function memberLabel(m: CircleMemberWithProfile): string {
  return m.display_name?.trim() || m.name?.trim() || 'Member'
}

export default function SplitExpenseSheet({
  circleId,
  members,
  currentUserId,
  currency,
  onClose,
  onComplete,
}: Props) {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Social')
  const [selectedIds, setSelectedIds] = useState<string[]>(() => members.map(m => m.user_id))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [createdMoment, setCreatedMoment] = useState<CircleMoment | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)

  useEffect(() => {
    setSelectedIds(members.map(m => m.user_id))
  }, [members])

  const toggleMember = (userId: string) => {
    setSelectedIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const createdContent = createdMoment?.content as ExpenseSplitContent | undefined
  const myShare = createdContent ? shareForUser(createdContent, currentUserId) : null

  const previewShare = useMemo(() => {
    const total = parseFloat(amount)
    if (!total || total <= 0 || selectedIds.length < 2) return null
    return Math.round((total / selectedIds.length) * 100) / 100
  }, [amount, selectedIds.length])

  const handleCreate = async () => {
    const total = parseFloat(amount)
    if (!description.trim() || !total || total <= 0) {
      setError('Enter a description and valid amount')
      return
    }
    if (selectedIds.length < 2) {
      setError('Select at least 2 members')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const moment = await createCircleSplit(circleId, {
        description: description.trim(),
        total_amount: total,
        category,
        participant_ids: selectedIds,
      })
      setCreatedMoment(moment)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create split')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClaim = async () => {
    if (!createdMoment) return
    setClaiming(true)
    setClaimError(null)
    try {
      await claimCircleSplit(createdMoment.id)
      setClaimed(true)
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Could not add your share')
    } finally {
      setClaiming(false)
    }
  }

  const handleDone = () => {
    onComplete()
    onClose()
  }

  if (createdMoment && createdContent) {
    return (
      <>
        <div className="overlay" onClick={handleDone} />
        <div className="bottom-sheet">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-fraunces text-xl font-semibold text-ink">Split shared ✓</h3>
            <button type="button" onClick={handleDone} className="text-ink-3 text-2xl">×</button>
          </div>

          <p className="text-sm text-ink mb-4">
            {createdContent.description}{' '}
            {formatCurrency(createdContent.total_amount, createdContent.currency)} — split{' '}
            {createdContent.split_count} ways. Your circle can see this total.
          </p>

          {myShare != null && (
            <div className="bg-cream rounded-xl p-4 mb-4">
              <p className="text-sm text-ink mb-3">
                Your share:{' '}
                <span className="font-semibold">
                  {formatCurrency(myShare, createdContent.currency)}
                </span>
              </p>
              {claimed ? (
                <p className="text-sm text-safe font-medium">✓ Added to your expenses</p>
              ) : (
                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={claiming}
                  className="btn-primary w-full"
                >
                  {claiming
                    ? 'Adding…'
                    : `Add my ${formatCurrency(myShare, createdContent.currency)} to my expenses`}
                </button>
              )}
              {claimError && (
                <p className="text-xs text-danger mt-2">{claimError}</p>
              )}
            </div>
          )}

          <button type="button" onClick={handleDone} className="w-full py-3 text-sm font-medium text-ink-3">
            Done — view in feed
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="bottom-sheet max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-fraunces text-xl font-semibold text-ink">Split an expense</h3>
          <button type="button" onClick={onClose} className="text-ink-3 text-2xl">×</button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <p className="text-sm font-medium text-ink mb-1">Visible to your circle</p>
          <p className="text-xs text-ink-3 leading-relaxed">
            This split will show the total amount and each person&apos;s share to everyone in this
            circle. Only you choose whether to add your share to your personal expenses.
          </p>
        </div>

        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was it? (e.g. Dinner)"
          className="input-field mb-3"
          maxLength={120}
        />

        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Amount (${currency})`}
          className="input-field mb-3"
          inputMode="decimal"
          min="0"
          step="0.01"
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="input-field mb-4"
        >
          {EXPENSE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2">
          Split between
        </p>
        <div className="flex flex-col gap-2 mb-4 max-h-40 overflow-y-auto">
          {members.map((m) => {
            const checked = selectedIds.includes(m.user_id)
            return (
              <label
                key={m.user_id}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer ${
                  checked ? 'bg-saffron-soft' : 'bg-cream'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMember(m.user_id)}
                  className="w-4 h-4 accent-saffron"
                />
                <span className="text-sm font-medium text-ink">
                  {memberLabel(m)}
                  {m.user_id === currentUserId ? ' (you)' : ''}
                </span>
              </label>
            )
          })}
        </div>

        {previewShare != null && (
          <p className="text-xs text-ink-3 mb-3">
            About {formatCurrency(previewShare, currency)} each (equal split)
          </p>
        )}

        {error && <p className="text-xs text-danger mb-3">{error}</p>}

        <button
          type="button"
          onClick={handleCreate}
          disabled={submitting}
          className="btn-primary"
        >
          {submitting ? 'Sharing…' : 'Share split with circle'}
        </button>
      </div>
    </>
  )
}
