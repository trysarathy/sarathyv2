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
}

export default function CurrencySelector({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false)
  const selected = CURRENCIES.find(c => c.code === value) || CURRENCIES[0]

  return (
    <div className="relative">
      {label && (
        <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2">{label}</p>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="input-field flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{selected.flag}</span>
          <span className="font-medium text-ink">{selected.code}</span>
          <span className="text-ink-3 text-sm">— {selected.name}</span>
        </div>
        <span className="text-ink-3">{open ? '↑' : '↓'}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl z-50 max-h-72 overflow-y-auto border border-cream-3">
            {CURRENCIES.map(c => (
              <button
                key={c.code}
                onClick={() => { onChange(c.code); setOpen(false) }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-cream transition-colors border-b border-cream last:border-0 ${
                  value === c.code ? 'bg-saffron-soft' : ''
                }`}
              >
                <span className="text-xl">{c.flag}</span>
                <div>
                  <p className="font-medium text-ink text-sm">{c.code}</p>
                  <p className="text-xs text-ink-3">{c.name}</p>
                </div>
                <span className="ml-auto text-sm font-semibold text-ink-3">{c.symbol}</span>
                {value === c.code && <span className="text-saffron text-sm">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
