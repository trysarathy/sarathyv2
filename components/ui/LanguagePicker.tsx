'use client'

import {
  LANGUAGE_OPTIONS,
  type PreferredLanguageCode,
} from '@/lib/languages'

interface Props {
  value: PreferredLanguageCode
  onChange: (code: PreferredLanguageCode) => void
  /** Visual density for onboarding vs profile. */
  compact?: boolean
}

export default function LanguagePicker({ value, onChange, compact = false }: Props) {
  return (
    <div className={`flex flex-col ${compact ? 'gap-2' : 'gap-3'}`}>
      {LANGUAGE_OPTIONS.map((lang) => {
        const selected = value === lang.code
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => onChange(lang.code)}
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
              {lang.flag}
            </span>
            <span
              className={`font-semibold ${
                compact ? 'text-sm text-indigo' : 'text-sm text-ink'
              }`}
            >
              {lang.label}
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
