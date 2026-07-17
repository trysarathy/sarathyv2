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
  /** Prefill from a just-logged personal expense */
  initialAmount?: string
  initialDescription?: string
  initialCategory?: string
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
  initialAmount = '',
  initialDescription = '',
  initialCategory = 'Social',
}: Props) {
  const [amount, setAmount] = useState(initialAmount)
  const [description, setDescription] = useState(initialDescription)
  const [category, setCategory] = useState(initialCategory)
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

  const parsedAmount = parseFloat(amount)
  const displayAmount =
    parsedAmount > 0 ? formatCurrency(parsedAmount, currency) : '—'

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
        <div className="circles-overlay" onClick={handleDone} />
        <div className="circles-sheet circles-enter-1">
          <div className="circles-sheet-indigo-top">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="circles-kicker text-indigo-muted mb-1">Shared with circle</p>
                <h3 className="font-fraunces text-xl font-semibold text-ink-on-indigo">Split shared</h3>
              </div>
              <button type="button" onClick={handleDone} className="text-ink-on-indigo/50 text-2xl leading-none">×</button>
            </div>
            <p className="font-fraunces text-lg text-ink-on-indigo/90 mb-1">{createdContent.description}</p>
            <p className="circles-split-hero-amount">{formatCurrency(createdContent.total_amount, createdContent.currency)}</p>
            <p className="text-xs text-ink-on-indigo/55 mt-2">
              Split {createdContent.split_count} ways · visible to everyone in this circle
            </p>
          </div>

          {myShare != null && (
            <div className="circles-card mb-4">
              <p className="text-sm text-indigo mb-1">Your share</p>
              <p className="font-fraunces text-2xl font-light text-indigo mb-4">
                {formatCurrency(myShare, createdContent.currency)}
              </p>
              {claimed ? (
                <p className="text-sm text-safe font-medium flex items-center gap-1.5">
                  <span className="text-gold">✓</span> Added to your expenses
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={claiming}
                  className="circles-btn-coral"
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
      <div className="circles-overlay" onClick={onClose} />
      <div className="circles-sheet circles-enter-1">
        <div className="circles-sheet-indigo-top">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="circles-kicker text-indigo-muted mb-1">Circle split</p>
              <h3 className="font-fraunces text-xl font-semibold text-ink-on-indigo">Split an expense</h3>
            </div>
            <button type="button" onClick={onClose} className="text-ink-on-indigo/50 text-2xl leading-none">×</button>
          </div>

          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was it? (e.g. Dinner)"
            className="circles-input-indigo mb-3"
            maxLength={120}
          />

          <div className="flex items-baseline gap-2 mb-1">
            <p className="circles-split-hero-amount">{displayAmount}</p>
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Enter amount (${currency})`}
            className="circles-input-indigo text-sm"
            inputMode="decimal"
            min="0"
            step="0.01"
          />
          {previewShare != null && (
            <p className="text-xs text-ink-on-indigo/55 mt-2">
              About {formatCurrency(previewShare, currency)} each · {selectedIds.length} people
            </p>
          )}
        </div>

        <div className="circles-notice mb-4 mt-1">
          <p className="text-sm font-medium text-indigo mb-1">Visible to your circle</p>
          <p className="text-xs text-ink-3 leading-relaxed">
            This split will show the total amount and each person&apos;s share to everyone in this
            circle. Only you choose whether to add your share to your personal expenses.
          </p>
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="circles-input mb-4"
        >
          {EXPENSE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <p className="text-xs font-semibold text-indigo/50 uppercase tracking-wide mb-2">
          Split between
        </p>
        <div className="flex flex-col gap-2 mb-4 max-h-40 overflow-y-auto">
          {members.map((m) => {
            const checked = selectedIds.includes(m.user_id)
            return (
              <label
                key={m.user_id}
                className={`circles-member-row ${checked ? 'circles-member-row-selected' : 'circles-member-row-unselected'}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMember(m.user_id)}
                  className="w-4 h-4 accent-indigo"
                />
                <span className="text-sm font-medium text-indigo">
                  {memberLabel(m)}
                  {m.user_id === currentUserId ? ' (you)' : ''}
                </span>
              </label>
            )
          })}
        </div>

        {error && <p className="text-xs text-danger mb-3">{error}</p>}

        <button
          type="button"
          onClick={handleCreate}
          disabled={submitting}
          className="circles-btn-coral"
        >
          {submitting ? 'Sharing…' : 'Share split with circle'}
        </button>
      </div>
    </>
  )
}
