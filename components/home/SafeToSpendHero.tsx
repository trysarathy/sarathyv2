'use client'

import { formatCurrency } from '@/lib/calculations'
import type { Profile, SafeToSpendData } from '@/types'

interface Props {
  profile: Profile
  safeData: SafeToSpendData
  todaySpent: number
  meterPercent: number
  meterColor: string
  onTap: () => void
}

const STATUS_WORD: Record<'tight' | 'danger', string> = {
  tight: 'Tight',
  danger: 'Danger',
}

export default function SafeToSpendHero({
  profile,
  safeData,
  todaySpent,
  meterPercent,
  meterColor,
  onTap,
}: Props) {
  const currency = profile.primary_currency || 'SGD'
  const numberColor =
    safeData.status === 'safe'
      ? 'text-safe'
      : safeData.status === 'tight'
        ? 'text-warning'
        : 'text-danger'

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full bg-white rounded-2xl p-5 shadow-sm text-left active:scale-[0.98] transition-transform mb-3"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-ink-3 text-xs font-medium tracking-wide">
            Safe to spend today
          </p>
          {safeData.status !== 'safe' && (
            <span
              className={`text-xs font-semibold shrink-0 ${
                safeData.status === 'tight' ? 'text-warning' : 'text-danger'
              }`}
            >
              {STATUS_WORD[safeData.status]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-ink-3 shrink-0">
          <span>🔥 {profile.daily_login_streak}d</span>
          <span>·</span>
          <span>⚡ {profile.total_xp}</span>
        </div>
      </div>

      <p className={`safe-number-hero ${numberColor}`}>
        {formatCurrency(safeData.safeToSpend, currency)}
      </p>

      {safeData.savings.status === 'protected' && (
        <p className="text-safe text-xs font-medium mt-3">
          🛡️ {formatCurrency(safeData.savings.monthlyGoal, currency)} savings protected this month
        </p>
      )}
      {safeData.savings.status === 'at_risk' && safeData.savings.stillPossible !== null && (
        <p className="text-warning text-xs font-medium mt-3">
          ⚠️ {formatCurrency(safeData.savings.stillPossible, currency)} of your{' '}
          {formatCurrency(safeData.savings.monthlyGoal, currency)} savings goal still possible
        </p>
      )}

      <div className="mt-4">
        <div className="flex justify-between items-center mb-1.5">
          <p className="text-[11px] text-ink-3">Today</p>
          <p className="text-[11px] text-ink-3">
            {formatCurrency(todaySpent, currency)} / {formatCurrency(safeData.safeToSpend, currency)}
          </p>
        </div>
        <div className="meter-bar h-1.5">
          <div
            className="meter-fill h-1.5 rounded-full transition-all"
            style={{ width: `${meterPercent}%`, background: meterColor }}
          />
        </div>
      </div>

      <p className="text-ink-3 text-xs mt-3">Tap to see how I calculated this →</p>
    </button>
  )
}
