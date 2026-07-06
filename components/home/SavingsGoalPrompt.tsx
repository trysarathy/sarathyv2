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
      await saveMonthlySavingsGoal(parsed)
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
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 border border-saffron/15">
      <p className="font-fraunces text-base font-medium text-ink mb-1">
        Want Sarathy to protect some savings each month?
      </p>
      <p className="text-ink-3 text-xs mb-3">
        Set a goal and your safe-to-spend will already set that money aside.
      </p>

      <div className="flex gap-2 mb-3">
        <input
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="150"
          className="input-field flex-1 py-2.5 text-sm"
        />
        <button
          onClick={handleSave}
          disabled={saving || !amount || parseFloat(amount) <= 0}
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-saffron disabled:opacity-50"
        >
          Set
        </button>
      </div>

      <div className="flex items-center justify-between">
        <Link href="/profile" className="text-xs text-saffron font-medium">
          Set in Profile →
        </Link>
        <button
          onClick={handleDismiss}
          disabled={saving}
          className="text-xs text-ink-3"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
