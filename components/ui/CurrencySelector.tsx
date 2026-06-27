'use client'
import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export const CURRENCIES = [
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'INR', symbol: 'Rs', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: 'GBP', name: 'British Pound' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'VND', symbol: 'VND', name: 'Vietnamese Dong' },
  { code: 'CNY', symbol: 'CNY', name: 'Chinese Yuan' },
  { code: 'EUR', symbol: 'EUR', name: 'Euro' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'PHP', symbol: 'PHP', name: 'Philippine Peso' },
  { code: 'BDT', symbol: 'BDT', name: 'Bangladeshi Taka' },
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
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</p>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="input-field flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-lg bg-saffron-soft px-2.5 py-1 text-xs font-bold text-saffron">
            {selected.code}
          </span>
          <span className="truncate text-sm font-medium text-ink">{selected.name}</span>
        </div>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-line bg-white shadow-xl">
            {CURRENCIES.map(c => (
              <button
                key={c.code}
                type="button"
                onClick={() => { onChange(c.code); setOpen(false) }}
                className={`flex w-full items-center gap-3 border-b border-cream px-4 py-3 text-left last:border-0 hover:bg-cream ${
                  value === c.code ? 'bg-saffron-soft' : ''
                }`}
              >
                <span className="w-12 text-sm font-bold text-ink">{c.code}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                  <p className="text-xs text-ink-3">{c.symbol}</p>
                </div>
                {value === c.code && <Check className="h-4 w-4 text-saffron" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
