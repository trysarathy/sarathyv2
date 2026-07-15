'use client'

import {
  LIFE_CURRENCY_OPTIONS,
  type LifeCurrency,
} from '@/lib/home/display-currency'

interface Props {
  value: LifeCurrency
  onChange: (code: LifeCurrency) => void
  compact?: boolean
}

export default function OnboardingCurrencyPicker({
  value,
  onChange,
  compact = false,
}: Props) {
  return (
    <div className={`flex flex-col ${compact ? 'gap-2' : 'gap-3'}`}>
      {LIFE_CURRENCY_OPTIONS.map((opt) => {
        const selected = value === opt.code
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => onChange(opt.code)}
            className={`flex items-center gap-3 text-left transition-all ${
              compact
                ? `px-3 py-2.5 rounded-xl border-2 ${
                    selected
                      ? 'border-indigo bg-indigo/[0.06]'
                      : 'border-transparent bg-white'
                  }`
                : `p-4 rounded-2xl border-2 ${
                    selected
                      ? 'border-saffron bg-saffron-soft'
                      : 'border-transparent bg-white'
                  }`
            }`}
          >
            <span className={compact ? 'text-xl' : 'text-2xl'} aria-hidden>
              {opt.flag}
            </span>
            <span
              className={`font-semibold min-w-0 ${
                compact ? 'text-sm text-indigo' : 'text-sm text-ink'
              }`}
            >
              {opt.label}
            </span>
            {selected && (
              <span className={`ml-auto text-sm ${compact ? 'text-gold' : 'text-saffron'}`}>
                ✓
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
