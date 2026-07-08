'use client'
import { useState } from 'react'

export const CURRENCIES = [
  { code: 'SGD', symbol: 'S$', flag: '🇸🇬', name: 'Singapore Dollar' },
  { code: 'INR', symbol: '₹', flag: '🇮🇳', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', flag: '🇺🇸', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', flag: '🇬🇧', name: 'British Pound' },
  { code: 'AUD', symbol: 'A$', flag: '🇦🇺', name: 'Australian Dollar' },
  { code: 'VND', symbol: '₫', flag: '🇻🇳', name: 'Vietnamese Dong' },
  { code: 'CNY', symbol: '¥', flag: '🇨🇳', name: 'Chinese Yuan' },
  { code: 'EUR', symbol: '€', flag: '🇪🇺', name: 'Euro' },
  { code: 'CAD', symbol: 'C$', flag: '🇨🇦', name: 'Canadian Dollar' },
  { code: 'MYR', symbol: 'RM', flag: '🇲🇾', name: 'Malaysian Ringgit' },
  { code: 'PHP', symbol: '₱', flag: '🇵🇭', name: 'Philippine Peso' },
  { code: 'BDT', symbol: '৳', flag: '🇧🇩', name: 'Bangladeshi Taka' },
]

interface Props {
  value: string
  onChange: (code: string) => void
  label?: string
  /** Limit choices — e.g. life currencies only for profile primary. */
  allowedCodes?: string[]
}

export default function CurrencySelector({ value, onChange, label, allowedCodes }: Props) {
  const [open, setOpen] = useState(false)
  const options = allowedCodes
    ? CURRENCIES.filter(c => allowedCodes.includes(c.code))
    : CURRENCIES
  const selected = options.find(c => c.code === value) || options[0] || CURRENCIES[0]

  return (
    <div className="relative">
      {label && (
        <p className="profile-section-kicker">{label}</p>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="profile-currency-trigger"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">{selected.flag}</span>
          <span className="font-semibold text-indigo text-sm">{selected.code}</span>
          <span className="text-indigo-muted text-sm truncate">— {selected.name}</span>
        </div>
        <span className="text-indigo-muted text-sm shrink-0 ml-2">{open ? '↑' : '↓'}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="profile-currency-menu">
            {options.map(c => (
              <button
                key={c.code}
                type="button"
                onClick={() => { onChange(c.code); setOpen(false) }}
                className={`profile-currency-option ${value === c.code ? 'profile-currency-option-selected' : ''}`}
              >
                <span className="text-xl">{c.flag}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-indigo text-sm">{c.code}</p>
                  <p className="text-xs text-indigo-muted">{c.name}</p>
                </div>
                <span className="text-sm font-semibold text-indigo-muted">{c.symbol}</span>
                {value === c.code && <span className="text-gold text-sm">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
