'use client'

import { formatCurrency, getCategoryEmoji } from '@/lib/calculations'
import type { PLCategory, Profile } from '@/types'

interface Props {
  profile: Profile
  categories: PLCategory[]
  monthTotal: number
  currency: string
  onSelectCategory: (cat: PLCategory) => void
  onClose: () => void
}

export default function MonthSummarySheet({
  profile,
  categories,
  monthTotal,
  currency,
  onSelectCategory,
  onClose,
}: Props) {
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="bottom-sheet max-h-[85dvh] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h3 className="font-fraunces text-lg font-semibold text-ink">This month</h3>
            <p className="text-ink-3 text-xs">Tap a category for details</p>
          </div>
          <button type="button" onClick={onClose} className="text-ink-3 text-2xl leading-none">
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {profile.planning_amount && (
            <div className="flex items-center justify-between py-3 border-b border-cream">
              <div className="flex items-center gap-2">
                <span>💰</span>
                <span className="text-sm font-medium text-ink">Budget</span>
              </div>
              <span className="text-sm font-semibold text-safe">
                +{formatCurrency(profile.planning_amount, currency)}
              </span>
            </div>
          )}

          {categories.length === 0 ? (
            <p className="py-8 text-center text-ink-3 text-sm">
              No expenses yet this month — log your first one 👇
            </p>
          ) : (
            categories.map((cat) => (
              <button
                key={cat.category}
                type="button"
                onClick={() => onSelectCategory(cat)}
                className="w-full flex items-center justify-between py-3 border-b border-cream last:border-0 active:bg-cream transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span>{getCategoryEmoji(cat.category)}</span>
                  <span className="text-sm font-medium text-ink">{cat.category}</span>
                  <span className="text-xs text-ink-3">{cat.percentage}%</span>
                </div>
                <span className="text-sm font-medium text-ink">
                  {formatCurrency(cat.total, currency)}
                </span>
              </button>
            ))
          )}

          {profile.planning_amount && (
            <div className="flex items-center justify-between py-3 mt-1 bg-cream rounded-xl px-3">
              <span className="text-sm font-semibold text-ink">Balance</span>
              <span
                className={`text-sm font-bold ${
                  profile.planning_amount - monthTotal >= 0 ? 'text-safe' : 'text-danger'
                }`}
              >
                {formatCurrency(profile.planning_amount - monthTotal, currency)}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
