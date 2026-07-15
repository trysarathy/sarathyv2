'use client'

import { useId } from 'react'
import {
  formatAbsoluteEntryDate,
  todayInSingapore,
} from '@/lib/sarathy/sgt'

interface Props {
  value: string
  onChange: (date: string) => void
  /** Latest selectable day (YYYY-MM-DD). Defaults to today (SGT). */
  max?: string
  id?: string
  className?: string
}

/**
 * Visible date field for Log Expense.
 * Shows absolute text (e.g. "14 Jul 2026") and opens the native date picker on tap
 * via a full-size transparent <input type="date"> overlay — reliable on Safari + Chrome.
 */
export default function ExpenseDatePicker({
  value,
  onChange,
  max,
  id,
  className = '',
}: Props) {
  const autoId = useId()
  const fieldId = id ?? `expense-date-${autoId}`
  const today = todayInSingapore()
  const maxDate = max && max <= today ? max : today
  const safeValue = value && value <= maxDate ? value.slice(0, 10) : maxDate

  return (
    <div className={`expense-date-picker ${className}`.trim()}>
      <label htmlFor={fieldId} className="log-sheet-section-kicker">
        Date
      </label>
      <div className="expense-date-field">
        <span className="expense-date-display">{formatAbsoluteEntryDate(safeValue)}</span>
        <span className="expense-date-chevron" aria-hidden>
          ▾
        </span>
        <input
          id={fieldId}
          type="date"
          value={safeValue}
          max={maxDate}
          onChange={(e) => {
            const next = e.target.value || maxDate
            onChange(next > maxDate ? maxDate : next)
          }}
          className="expense-date-native"
          aria-label="Expense date"
        />
      </div>
    </div>
  )
}
