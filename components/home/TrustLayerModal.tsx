'use client'
import { SafeToSpendData } from '@/types'
import { formatCurrency } from '@/lib/calculations'

interface Props {
  safeData: SafeToSpendData
  onClose: () => void
}

export default function TrustLayerModal({ safeData, onClose }: Props) {
  const dailyBudget = safeData.dailyBudget
  const spentToday = safeData.spentToday

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="bottom-sheet">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-fraunces text-xl font-semibold text-ink">How I calculated this</h3>
          <button onClick={onClose} className="text-ink-3 text-2xl">×</button>
        </div>

        <p className="text-ink-3 text-sm mb-5">
          Today&apos;s safe-to-spend only counts expenses logged for today. Past days show up in your monthly progress — not here.
        </p>

        <div className="flex flex-col gap-3 mb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono w-4 text-safe">+</span>
              <span className="text-sm text-ink">Daily budget ({safeData.daysLeft} days left)</span>
            </div>
            <span className="text-sm font-semibold text-safe">
              {formatCurrency(dailyBudget, safeData.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono w-4 text-danger">−</span>
              <span className="text-sm text-ink">Spent today</span>
            </div>
            <span className="text-sm font-semibold text-danger">
              {formatCurrency(spentToday, safeData.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-cream">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono w-4 text-ink font-semibold">=</span>
              <span className="text-sm text-ink font-semibold">Safe to spend today</span>
            </div>
            <span className="text-sm font-semibold text-ink">
              {formatCurrency(safeData.safeToSpend, safeData.currency)}
            </span>
          </div>
        </div>

        <div className="bg-cream rounded-xl p-4 border border-saffron-soft mb-3">
          <p className="text-xs text-ink-3 mb-1">
            Monthly plan ÷ {safeData.daysLeft} days remaining
          </p>
          <p className="font-fraunces text-2xl font-semibold text-saffron">
            {formatCurrency(safeData.safeToSpend, safeData.currency)} left today
          </p>
          <p className="text-xs text-ink-3 mt-1">Based on today&apos;s expenses only.</p>
        </div>

        <p className="text-xs text-ink-3 mb-4 leading-relaxed">
          This month so far: {formatCurrency(safeData.alreadySpent, safeData.currency)} of{' '}
          {formatCurrency(safeData.planAmount, safeData.currency)} — that lives in your monthly progress bar.
        </p>

        <button className="btn-primary mt-1" onClick={onClose}>Got it 👍</button>
      </div>
    </>
  )
}
