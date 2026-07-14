'use client'

import { formatCurrency } from '@/lib/calculations'
import { formatDreamHeroLine } from '@/lib/dream-goal'
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

function renderSavingsLine(safeData: SafeToSpendData, currency: string) {
  const { savings } = safeData
  const dream = savings.dream

  if (dream?.targetAmount && dream.targetDate) {
    const dreamLine = formatDreamHeroLine(dream, currency)
    if (dreamLine) {
      const tone =
        savings.status === 'at_risk' && !dream.funded
          ? 'text-amber-300/90'
          : 'text-ink-on-indigo/80'
      return (
        <p className={`${tone} text-xs font-medium`}>
          {dreamLine}
        </p>
      )
    }
  }

  if (savings.status === 'protected') {
    return (
      <p className="text-ink-on-indigo/80 text-xs font-medium">
        <span className="text-gold">🛡️</span>{' '}
        {savings.goalName
          ? `${savings.goalName}: ${formatCurrency(savings.monthlyGoal, currency)} protected`
          : `${formatCurrency(savings.monthlyGoal, currency)} savings protected this month`}
      </p>
    )
  }

  if (savings.status === 'at_risk' && savings.stillPossible !== null) {
    return (
      <p className="text-amber-300/90 text-xs font-medium">
        ⚠️ {formatCurrency(savings.stillPossible, currency)} of your{' '}
        {savings.goalName
          ? `${savings.goalName} (${formatCurrency(savings.monthlyGoal, currency)})`
          : formatCurrency(savings.monthlyGoal, currency)}{' '}
        still possible
      </p>
    )
  }

  return null
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
  const savingsLine = renderSavingsLine(safeData, currency)
  const showSavings =
    savingsLine !== null &&
    (safeData.savings.status === 'protected' ||
      safeData.savings.status === 'at_risk' ||
      Boolean(safeData.savings.dream?.targetAmount && safeData.savings.dream?.targetDate) ||
      Boolean(safeData.savings.dream?.funded))

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
      <p className="text-indigo-muted text-[11px] mt-1 mb-1">
        Based on today&apos;s expenses only
      </p>

      <AccountsSummaryLine profile={profile} />

      {showSavings && <div className="mt-4">{savingsLine}</div>}

      <div className="mt-5 space-y-1.5">
        <div className="flex justify-between items-center">
          <p className="text-[11px] text-indigo-muted uppercase tracking-wide">Today</p>
          <p className="text-[11px] text-ink-on-indigo/60 tabular-nums">
            {formatCurrency(todaySpent, currency)} /{' '}
            {formatCurrency(safeData.dailyBudget, currency)}
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
