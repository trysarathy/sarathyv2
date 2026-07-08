'use client'

import { useState } from 'react'
import Link from 'next/link'
import { dismissSavingsGoalPrompt, saveMonthlySavingsGoal } from '@/lib/savings-goal'
import type { Profile } from '@/types'

interface Props {
  profile: Profile
  onUpdated: () => void
}

export default function SavingsGoalPrompt({ profile, onUpdated }: Props) {
  const [amount, setAmount] = useState('')
  const [goalName, setGoalName] = useState('')
  const [saving, setSaving] = useState(false)

  const show =
    (profile.monthly_savings_goal ?? 0) === 0 &&
    !profile.savings_goal_prompt_dismissed

  if (!show) return null

  const handleSave = async () => {
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return
    setSaving(true)
    try {
      await saveMonthlySavingsGoal(parsed, goalName)
      onUpdated()
    } finally {
      setSaving(false)
    }
  }

  const handleDismiss = async () => {
    setSaving(true)
    try {
      await dismissSavingsGoalPrompt()
      onUpdated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="home-savings-prompt">
      <p className="font-fraunces text-base font-medium text-ink-on-indigo mb-1">
        Want Sarathy to protect some savings each month?
      </p>
      <p className="text-indigo-muted text-xs mb-3">
        Set a goal and your safe-to-spend will already set that money aside.
      </p>

      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={goalName}
          onChange={(e) => setGoalName(e.target.value)}
          placeholder="Name (e.g. Bali fund)"
          maxLength={80}
          className="home-savings-input flex-[2] min-w-0"
        />
        <input
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="150"
          className="home-savings-input flex-1 min-w-[4.5rem]"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !amount || parseFloat(amount) <= 0}
          className="home-btn-indigo-outline shrink-0"
        >
          Set
        </button>
      </div>

      <div className="flex items-center justify-between">
        <Link
          href="/profile"
          className="text-xs text-ink-on-indigo/70 font-medium hover:text-ink-on-indigo transition-colors"
        >
          Set in Profile →
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={saving}
          className="text-xs text-indigo-muted hover:text-ink-on-indigo/80 transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
