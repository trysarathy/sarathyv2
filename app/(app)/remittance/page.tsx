'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Landmark,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/calculations'
import { getRemittanceIntro } from '@/lib/personalization'
import TabBar from '@/components/ui/TabBar'

const PROVIDERS: Array<{ name: string; fee: number; icon: LucideIcon }> = [
  { name: 'Wise', fee: 0.6, icon: CircleDollarSign },
  { name: 'Remitly', fee: 0.8, icon: Banknote },
  { name: 'Bank transfer', fee: 2.5, icon: Landmark },
  { name: 'Western Union', fee: 1.5, icon: Building2 },
]

const COUNTRY_CURRENCY: Record<string, string> = {
  India: 'INR',
  Philippines: 'PHP',
  Indonesia: 'IDR',
  Malaysia: 'MYR',
  Thailand: 'THB',
  Vietnam: 'VND',
  Bangladesh: 'BDT',
  Pakistan: 'PKR',
  Nepal: 'NPR',
  'Sri Lanka': 'LKR',
  China: 'CNY',
  Japan: 'JPY',
  Korea: 'KRW',
  'South Korea': 'KRW',
  Australia: 'AUD',
  'United States': 'USD',
  'United Kingdom': 'GBP',
}

function getHomeCurrency(homeCountry?: string | null) {
  const normalized = homeCountry?.trim().toLowerCase()
  if (!normalized) return 'INR'
  const match = Object.entries(COUNTRY_CURRENCY).find(([country]) => country.toLowerCase() === normalized)
  return match?.[1] || null
}

function formatDestinationAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString('en-SG')}`
  }
}

function formatExchangeRate(rate: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 4,
      minimumFractionDigits: rate < 1 ? 4 : 2,
    }).format(rate)
  } catch {
    return `${currency} ${rate.toFixed(rate < 1 ? 4 : 2)}`
  }
}

export default function RemittancePage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState<number | null>(null)
  const [rateLoading, setRateLoading] = useState(false)
  const [sarathyTip, setSarathyTip] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [rateError, setRateError] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('Wise')

  const fromCurrency = profile?.primary_currency || 'SGD'
  const toCurrency = getHomeCurrency(profile?.home_country)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const [profileRes, historyRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('remittance_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      ])

      const loadedProfile = profileRes.data || null
      if (loadedProfile) setProfile(loadedProfile)
      setHistory(historyRes.data || [])
      setLoading(false)
      fetchRate(loadedProfile)
    }
    load()
  }, [])

  const fetchRate = async (contextProfile = profile) => {
    setRateLoading(true)
    setRateError('')
    const sourceCurrency = contextProfile?.primary_currency || 'SGD'
    const destinationCurrency = getHomeCurrency(contextProfile?.home_country)
    if (!destinationCurrency) {
      setRate(null)
      setRateError('Set a supported home country before calculating this transfer.')
      setRateLoading(false)
      return
    }

    try {
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${sourceCurrency}`)
      if (!res.ok) throw new Error('Failed to fetch exchange rate')
      const data = await res.json()
      const liveRate = data.rates?.[destinationCurrency]
      if (!liveRate) throw new Error('Destination currency rate not found')
      setRate(liveRate)
      getSarathyTip(liveRate, contextProfile)
    } catch {
      if (sourceCurrency === 'SGD' && destinationCurrency === 'INR') {
        const fallbackRate = 61.5
        setRate(fallbackRate)
        setRateError('Using a fallback INR rate because the live rate is unavailable.')
        getSarathyTip(fallbackRate, contextProfile)
      } else {
        setRate(null)
        setRateError(`Live ${sourceCurrency} to ${destinationCurrency} rates are unavailable right now.`)
      }
    } finally { setRateLoading(false) }
  }

  const getSarathyTip = async (currentRate: number, contextProfile = profile) => {
    const sourceCurrency = contextProfile?.primary_currency || 'SGD'
    const destinationCurrency = getHomeCurrency(contextProfile?.home_country)
    try {
      const res = await fetch('/api/sarathy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `The current ${sourceCurrency} to ${destinationCurrency} rate is ${currentRate.toFixed(2)}. Is this a good time to send money home? Give me a one-sentence tip.`,
          isAnxious: false,
          context: {
            name: contextProfile?.name || 'there',
            companion_vibe: contextProfile?.companion_vibe || 'calm_mentor',
            currency: sourceCurrency,
            planning_amount: contextProfile?.planning_amount,
            spent: 0,
            safe_today: 0,
            days_remaining: 10,
            status: 'safe',
            money_fear: contextProfile?.money_fear,
            responsible_for: contextProfile?.responsible_for,
            streak: contextProfile?.daily_login_streak || 0,
          },
          history: [],
        }),
      })
      const data = await res.json()
      setSarathyTip(data.message)
    } catch { setSarathyTip('') }
  }

  const amountValue = Number(amount)
  const canCalculate = Number.isFinite(amountValue) && amountValue > 0
  const provider = PROVIDERS.find(p => p.name === selectedProvider)
  const inrAmount = canCalculate && rate ? amountValue * rate : 0
  const fee = canCalculate ? (amountValue * (provider?.fee || 0.6)) / 100 : 0
  const youGet = rate ? inrAmount - (fee * rate) : 0

  const handleSave = async () => {
    if (!canCalculate || !rate || !toCurrency) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('remittance_logs').insert({
        user_id: user.id,
        amount_sent: amountValue,
        from_currency: fromCurrency,
        to_currency: toCurrency,
        rate_used: rate,
        provider: selectedProvider,
      })
      setSaved(true)
      setAmount('')
      const { data } = await supabase.from('remittance_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
      setHistory(data || [])
      setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  const intro = getRemittanceIntro(profile)

  if (loading) return (
    <div className="min-h-dvh bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-dvh bg-cream pb-24">
      <div className="px-5 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-3" aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-fraunces text-2xl font-semibold text-ink">{intro.title}</h1>
        <p className="text-ink-3 text-sm">{fromCurrency} to {toCurrency || 'home currency'}. {intro.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="px-5 flex flex-col gap-4">

        {/* Live rate card */}
        <div className="bg-gradient-to-br from-saffron to-orange-600 rounded-2xl p-5 text-white">
          <p className="text-xs font-medium opacity-75 mb-1">Live rate today</p>
          {rateLoading ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <p className="font-fraunces text-3xl font-semibold mb-1">
                1 {fromCurrency} = {rate && toCurrency ? formatExchangeRate(rate, toCurrency) : 'Rate unavailable'}
              </p>
              <button onClick={() => fetchRate()} className="flex items-center gap-1 text-xs opacity-75 underline">
                <RefreshCw className="h-3 w-3" />
                Refresh rate
              </button>
            </>
          )}
        </div>

        {/* Sarathy tip */}
        {sarathyTip && (
          <div className="card border-l-4 border-saffron">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-saffron" />
              <p className="text-sm text-ink leading-relaxed">{sarathyTip}</p>
            </div>
          </div>
        )}

        {/* Calculator */}
        <div className="card">
          <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-3">Calculate transfer</p>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1">
              <p className="text-xs text-ink-3 mb-1">You send ({fromCurrency})</p>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="input-field text-xl font-fraunces"
                inputMode="decimal"
              />
            </div>
            <ArrowRight className="mt-4 h-5 w-5 flex-shrink-0 text-ink-3" />
            <div className="flex-1">
              <p className="text-xs text-ink-3 mb-1">They receive ({toCurrency || 'home currency'})</p>
              <div className="input-field text-xl font-fraunces bg-cream text-safe">
                {toCurrency ? (canCalculate && rate ? formatDestinationAmount(youGet, toCurrency) : formatDestinationAmount(0, toCurrency)) : '-'}
              </div>
            </div>
          </div>

          {rateError && (
            <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-danger" role="alert">
              {rateError}
            </div>
          )}

          {/* Provider comparison */}
          <p className="text-xs font-medium text-ink-3 mb-2">Choose provider</p>
          <div className="flex flex-col gap-2 mb-4">
            {PROVIDERS.map(p => {
              const ProviderIcon = p.icon
              return (
                <button
                  key={p.name}
                  onClick={() => setSelectedProvider(p.name)}
                  className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                    selectedProvider === p.name
                      ? 'bg-saffron-soft border-2 border-saffron'
                      : 'bg-cream border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ProviderIcon className="h-4 w-4 text-saffron" />
                    <span className="text-sm font-medium text-ink">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-ink-3">Fee: {p.fee}%</p>
                    {canCalculate && (
                      <p className="text-xs text-danger">
                        -{formatCurrency((amountValue * p.fee) / 100, fromCurrency)}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {saved && (
            <div className="flex items-center gap-2 bg-green-50 text-safe text-sm px-4 py-3 rounded-xl mb-3">
              <CheckCircle2 className="h-4 w-4" />
              Transfer logged successfully.
            </div>
          )}

          <button
            onClick={handleSave}
            className="btn-primary"
            disabled={saving || !canCalculate || !rate || !toCurrency}
          >
            {saving
              ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : 'Log this transfer'}
          </button>
        </div>

        {/* Transfer history */}
        {history.length > 0 && (
          <div className="card">
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-3">
              Transfer history
            </p>
            <div className="flex flex-col gap-2">
              {history.map(h => {
                const sentCurrency = h.from_currency || 'SGD'
                const receivedCurrency = h.to_currency || 'INR'
                return (
                  <div key={h.id} className="flex items-center justify-between py-2 border-b border-cream last:border-0">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {formatCurrency(h.amount_sent, sentCurrency)} to {formatDestinationAmount(h.amount_sent * h.rate_used, receivedCurrency)}
                      </p>
                      <p className="text-xs text-ink-3">
                        {h.provider} / Rate: {h.rate_used?.toFixed(2)} / {new Date(h.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <TabBar active="home" />
    </div>
  )
}
