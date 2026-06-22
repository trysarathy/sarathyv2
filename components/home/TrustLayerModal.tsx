'use client'
import { SafeToSpendData } from '@/types'
import { formatCurrency } from '@/lib/calculations'

interface Props {
  safeData: SafeToSpendData
  onClose: () => void
}

export default function TrustLayerModal({ safeData, onClose }: Props) {
  const rows = [
    { label: 'Your plan this month', value: safeData.planAmount, sign: '+', color: 'text-safe' },
    { label: 'Bills still due', value: -safeData.fixedLeft, sign: '−', color: 'text-danger' },
    { label: 'Already spent', value: -safeData.alreadySpent, sign: '−', color: 'text-danger' },
    { label: 'Safety buffer (10%)', value: -safeData.buffer, sign: '−', color: 'text-warning' },
    { label: 'Free to use', value: safeData.freeToUse, sign: '=', color: 'text-ink font-semibold' },
  ]

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="bottom-sheet">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-fraunces text-xl font-semibold text-ink">How I calculated this</h3>
          <button onClick={onClose} className="text-ink-3 text-2xl">×</button>
        </div>

        <p className="text-ink-3 text-sm mb-5">
          Every number here is from your own data — nothing made up.
        </p>

        <div className="flex flex-col gap-3 mb-5">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-mono w-4 ${row.color}`}>{row.sign}</span>
                <span className="text-sm text-ink">{row.label}</span>
              </div>
              <span className={`text-sm font-semibold ${row.color}`}>
                {formatCurrency(Math.abs(row.value), safeData.currency)}
              </span>
            </div>
          ))}
        </div>

        <div className="bg-cream rounded-xl p-4 border border-saffron-soft">
          <p className="text-xs text-ink-3 mb-1">Spread over {safeData.daysLeft} days remaining</p>
          <p className="font-fraunces text-2xl font-semibold text-saffron">
            {formatCurrency(safeData.safeToSpend, safeData.currency)} / day
          </p>
          <p className="text-xs text-ink-3 mt-1">That's your safe-to-spend today.</p>
        </div>

        <button className="btn-primary mt-4" onClick={onClose}>Got it 👍</button>
      </div>
    </>
  )
}
