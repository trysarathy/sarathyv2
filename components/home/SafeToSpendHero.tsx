'use client'

import { formatCurrency } from '@/lib/calculations'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'
import AccountsSummaryLine from '@/components/home/AccountsSummaryLine'
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

const NUMBER_COLOR: Record<'safe' | 'tight' | 'danger', string> = {
  safe: 'text-emerald-300',
  tight: 'text-amber-300',
  danger: 'text-rose-300',
}

export default function SafeToSpendHero({
  profile,
  safeData,
  todaySpent,
  meterPercent,
  meterColor,
  onTap,
}: Props) {
  const currency = getProfileDisplayCurrency(profile)

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full text-left active:scale-[0.99] transition-transform mb-6 py-2"
    >
      <div className="flex items-center justify-between gap-2 mb-5">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-indigo-muted text-[11px] font-medium uppercase tracking-[0.08em]">
            Safe to spend today
          </p>
          {safeData.status !== 'safe' && (
            <span
              className={`text-[11px] font-semibold shrink-0 uppercase tracking-wide ${
                safeData.status === 'tight' ? 'text-amber-300' : 'text-rose-300'
              }`}
            >
              {STATUS_WORD[safeData.status]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] shrink-0">
          <span className="text-gold font-medium">🔥 {profile.daily_login_streak}d</span>
          <span className="text-ink-on-indigo/40">·</span>
          <span className="text-ink-on-indigo/50">⚡ {profile.total_xp}</span>
        </div>
      </div>

      <p className={`safe-number-monument ${NUMBER_COLOR[safeData.status]}`}>
        {formatCurrency(safeData.safeToSpend, currency)}
      </p>

      <AccountsSummaryLine profile={profile} />

      {(safeData.savings.status === 'protected' || safeData.savings.status === 'at_risk') && (
        <div className="mt-4">
          {safeData.savings.status === 'protected' && (
            <p className="text-ink-on-indigo/80 text-xs font-medium">
              <span className="text-gold">🛡️</span>{' '}
              {formatCurrency(safeData.savings.monthlyGoal, currency)} savings protected this month
            </p>
          )}
          {safeData.savings.status === 'at_risk' && safeData.savings.stillPossible !== null && (
            <p className="text-amber-300/90 text-xs font-medium">
              ⚠️ {formatCurrency(safeData.savings.stillPossible, currency)} of your{' '}
              {formatCurrency(safeData.savings.monthlyGoal, currency)} savings goal still possible
            </p>
          )}
        </div>
      )}

      <div className="mt-5 space-y-1.5">
        <div className="flex justify-between items-center">
          <p className="text-[11px] text-indigo-muted uppercase tracking-wide">Today</p>
          <p className="text-[11px] text-ink-on-indigo/60 tabular-nums">
            {formatCurrency(todaySpent, currency)} / {formatCurrency(safeData.safeToSpend, currency)}
          </p>
        </div>
        <div className="home-meter-track">
          <div
            className="home-meter-fill"
            style={{ width: `${meterPercent}%`, background: meterColor }}
          />
        </div>
        <p className="text-indigo-muted text-[11px] pt-1">Tap to see how I calculated this →</p>
      </div>
    </button>
  )
}
