'use client'
import { Calculator, CheckCircle2, X } from 'lucide-react'
import { SafeToSpendData } from '@/types'
import { formatCurrency } from '@/lib/calculations'

interface Props {
  safeData: SafeToSpendData
  onClose: () => void
}

export default function TrustLayerModal({ safeData, onClose }: Props) {
  const rows = [
    { label: 'Your plan this month', value: safeData.planAmount, sign: '+', color: 'text-safe' },
    { label: 'Bills still due', value: safeData.fixedLeft, sign: '-', color: 'text-danger' },
    { label: 'Already spent', value: safeData.alreadySpent, sign: '-', color: 'text-danger' },
    { label: 'Safety buffer (10%)', value: safeData.buffer, sign: '-', color: 'text-warning' },
    { label: 'Free to use', value: safeData.freeToUse, sign: '=', color: 'text-ink font-semibold' },
  ]

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="bottom-sheet">
        <div className="sheet-handle" />
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-saffron-soft text-saffron">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-fraunces text-xl font-semibold text-ink">How this was calculated</h3>
              <p className="text-xs text-ink-3">Only your own budget data is used.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-3"
            aria-label="Close calculation details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 flex flex-col overflow-hidden rounded-2xl border border-line">
          {rows.map((row, i) => (
            <div key={row.label} className={`flex items-center justify-between gap-3 px-4 py-3 ${i < rows.length - 1 ? 'border-b border-cream' : 'bg-cream/60'}`}>
              <div className="flex min-w-0 items-center gap-3">
                <span className={`w-4 text-center font-mono text-sm ${row.color}`}>{row.sign}</span>
                <span className="truncate text-sm text-ink">{row.label}</span>
              </div>
              <span className={`text-sm font-semibold ${row.color}`}>
                {formatCurrency(row.value, safeData.currency)}
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-safe/20 bg-mint p-4">
          <div className="mb-2 flex items-center gap-2 text-safe">
            <CheckCircle2 className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-wide">
              Spread over {safeData.daysLeft} days remaining
            </p>
          </div>
          <p className="font-fraunces text-3xl font-semibold text-safe">
            {formatCurrency(safeData.safeToSpend, safeData.currency)} / day
          </p>
          <p className="mt-1 text-xs text-ink-3">This is your safe-to-spend number for today.</p>
        </div>

        <button type="button" className="btn-primary mt-4" onClick={onClose}>Got it</button>
      </div>
    </>
  )
}
