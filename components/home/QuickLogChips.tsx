'use client'

import type { QuickLogChip } from '@/lib/expense/quick-log-chips'
import { TODAY_COLORS } from '@/components/home/TodayView'
import { currencySymbol } from '@/lib/currency/convert'

interface Props {
  chips: QuickLogChip[]
  currency: string
  onSelect: (chip: QuickLogChip) => void
  onCustom: () => void
}

const C = TODAY_COLORS

function chipAmountLabel(amount: number, currency: string): string {
  const symbol = currencySymbol(currency)
  const n = Number.isFinite(amount) ? amount : 0
  const text = Number.isInteger(n) || Math.abs(n - Math.round(n)) < 0.001
    ? String(Math.round(n))
    : n.toFixed(2)
  return `${symbol}${text}`
}

export default function QuickLogChips({ chips, currency, onSelect, onCustom }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '8px 16px 4px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
      role="list"
      aria-label="Quick log"
    >
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          role="listitem"
          onClick={() => onSelect(chip)}
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 999,
            border: `1px solid ${C.creamBorder}`,
            background: C.white,
            color: C.purple,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 2px rgba(28, 15, 63, 0.04)',
          }}
        >
          <span aria-hidden>{chip.emoji}</span>
          <span>{chip.label}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.goldText,
              opacity: 0.9,
            }}
          >
            {chipAmountLabel(chip.amount, currency)}
          </span>
        </button>
      ))}

      <button
        type="button"
        role="listitem"
        onClick={onCustom}
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '8px 12px',
          borderRadius: 999,
          border: `1.5px dashed ${C.goldBorder}`,
          background: C.goldLight,
          color: C.goldText,
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        + Custom
      </button>
    </div>
  )
}
