'use client'

import { formatNudgeMoney, type NudgeLevel } from '@/lib/nudge/daily-budget'

interface Props {
  level: NudgeLevel
  remaining: number
  percentageRemaining: number | null
  currency: string
  onLogAnyway: () => void
  onReconsider: () => void
}

/** Pre-save budget warning / healthy cue for Log Expense. */
export default function PreSpendNudgeCard({
  level,
  remaining,
  percentageRemaining,
  currency,
  onLogAnyway,
  onReconsider,
}: Props) {
  if (level === 'healthy') {
    return (
      <p
        style={{
          margin: '0 0 12px',
          padding: '8px 12px',
          borderRadius: 10,
          background: 'rgba(34, 139, 84, 0.1)',
          color: '#1B6B3A',
          fontSize: 13,
          fontWeight: 600,
          textAlign: 'center',
        }}
      >
        You&apos;re doing well today ✓
      </p>
    )
  }

  if (level !== 'warn' && level !== 'over') return null

  const isOver = level === 'over'
  const pct =
    percentageRemaining != null
      ? Math.max(0, Math.round(percentageRemaining * 100))
      : 0
  const x = formatNudgeMoney(Math.abs(remaining), currency)

  return (
    <div
      role="alert"
      style={{
        marginBottom: 14,
        borderRadius: 14,
        padding: '14px 14px 12px',
        background: isOver ? '#FDE8E4' : '#FEF3DC',
        border: `1px solid ${isOver ? '#F5C4BB' : '#F5DFA0'}`,
      }}
    >
      <p
        style={{
          margin: '0 0 6px',
          fontSize: 13,
          fontWeight: 800,
          color: isOver ? '#8A2E1E' : '#8A5E10',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span aria-hidden>⚠️</span> Sarathy check
      </p>
      <p
        style={{
          margin: '0 0 12px',
          fontSize: 13,
          lineHeight: 1.45,
          color: isOver ? '#8A2E1E' : '#8A5E10',
        }}
      >
        {isOver
          ? `This puts you ${x} over your budget today.`
          : `This puts you at ${x} for the rest of today. That's ${pct}% of your daily budget.`}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={onLogAnyway}
          style={{
            flex: 1,
            border: 'none',
            borderRadius: 10,
            padding: '10px 8px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            background: isOver ? '#8A2E1E' : '#8A5E10',
            color: '#fff',
          }}
        >
          Log it anyway
        </button>
        <button
          type="button"
          onClick={onReconsider}
          style={{
            flex: 1,
            border: `1.5px solid ${isOver ? '#F5C4BB' : '#F5DFA0'}`,
            borderRadius: 10,
            padding: '10px 8px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            background: '#fff',
            color: isOver ? '#8A2E1E' : '#8A5E10',
          }}
        >
          Let me reconsider
        </button>
      </div>
    </div>
  )
}
