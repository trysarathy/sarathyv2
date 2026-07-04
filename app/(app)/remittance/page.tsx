'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/calculations'
import { getAuthHeaders } from '@/lib/api-auth'
import TabBar from '@/components/ui/TabBar'

const PROVIDERS = [
  { name: 'Wise', fee: 0.6, emoji: '💚' },
  { name: 'Remitly', fee: 0.8, emoji: '��' },
  { name: 'Bank transfer', fee: 2.5, emoji: '🏦' },
  { name: 'Western Union', fee: 1.5, emoji: '🟡' },
]

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
  const [selectedProvider, setSelectedProvider] = useState('Wise')

  const fromCurrency = 'SGD'
  const toCurrency = 'INR'

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const [profileRes, historyRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('remittance_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      ])

      if (profileRes.data) setProfile(profileRes.data)
      setHistory(historyRes.data || [])
      setLoading(false)
      fetchRate()
    }
    load()
  }, [])

  const fetchRate = async () => {
    setRateLoading(true)
    try {
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/SGD`)
      const data = await res.json()
      const inrRate = data.rates?.INR
      if (inrRate) {
        setRate(inrRate)
        getSarathyTip(inrRate)
      }
    } catch {
      setRate(61.5)
      getSarathyTip(61.5)
    } finally { setRateLoading(false) }
  }

  const getSarathyTip = async (currentRate: number) => {
    try {
      const res = await fetch('/api/sarathy', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          message: `The current SGD to INR rate is ${currentRate.toFixed(2)}. Is this a good time to send money home? Give me a one-sentence tip.`,
          isAnxious: false,
          context: {
            name: profile?.name || 'there',
            companion_vibe: profile?.companion_vibe || 'calm_mentor',
            currency: 'SGD',
            planning_amount: profile?.planning_amount,
            spent: 0,
            safe_today: 0,
            days_remaining: 10,
            status: 'safe',
            money_fear: profile?.money_fear,
            responsible_for: profile?.responsible_for,
            streak: profile?.daily_login_streak || 0,
          },
          history: [],
        }),
      })
      const data = await res.json()
      setSarathyTip(data.message)
    } catch { setSarathyTip('') }
  }

  const handleSave = async () => {
    if (!amount || !rate) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('remittance_logs').insert({
        user_id: user.id,
        amount_sent: parseFloat(amount),
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

  const inrAmount = amount && rate ? parseFloat(amount) * rate : 0
  const provider = PROVIDERS.find(p => p.name === selectedProvider)
  const fee = amount ? (parseFloat(amount) * (provider?.fee || 0.6)) / 100 : 0
  const youGet = inrAmount - (fee * (rate || 61.5))

  if (loading) return (
    <div className="min-h-dvh bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-dvh bg-cream pb-24">
      <div className="px-5 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => router.back()} className="text-ink-3 text-xl">←</button>
          <div>
            <h1 className="font-fraunces text-2xl font-semibold text-ink">Send money home</h1>
            <p className="text-ink-3 text-sm">SGD → INR · Live rate</p>
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
                1 SGD = ₹{rate?.toFixed(2)}
              </p>
              <button onClick={fetchRate} className="text-xs opacity-75 underline">
                Refresh rate
              </button>
            </>
          )}
        </div>

        {/* Sarathy tip */}
        {sarathyTip && (
          <div className="card border-l-4 border-saffron">
            <div className="flex items-start gap-2">
              <span className="text-lg">🌸</span>
              <p className="text-sm text-ink leading-relaxed">{sarathyTip}</p>
            </div>
          </div>
        )}

        {/* Calculator */}
        <div className="card">
          <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-3">Calculate transfer</p>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1">
              <p className="text-xs text-ink-3 mb-1">You send (SGD)</p>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="input-field text-xl font-fraunces"
                inputMode="decimal"
              />
            </div>
            <div className="text-2xl mt-4">→</div>
            <div className="flex-1">
              <p className="text-xs text-ink-3 mb-1">They receive (INR)</p>
              <div className="input-field text-xl font-fraunces bg-cream text-safe">
                {inrAmount > 0 ? `₹${Math.round(youGet).toLocaleString('en-IN')}` : '₹0'}
              </div>
            </div>
          </div>

          {/* Provider comparison */}
          <p className="text-xs font-medium text-ink-3 mb-2">Choose provider</p>
          <div className="flex flex-col gap-2 mb-4">
            {PROVIDERS.map(p => (
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
                  <span>{p.emoji}</span>
                  <span className="text-sm font-medium text-ink">{p.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-ink-3">Fee: {p.fee}%</p>
                  {amount && (
                    <p className="text-xs text-danger">
                      -{formatCurrency((parseFloat(amount) * p.fee) / 100, 'SGD')}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {saved && (
            <div className="bg-green-50 text-safe text-sm px-4 py-3 rounded-xl mb-3">
              ✅ Transfer logged successfully!
            </div>
          )}

          <button
            onClick={handleSave}
            className="btn-primary"
            disabled={saving || !amount || !rate}
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
              {history.map(h => (
                <div key={h.id} className="flex items-center justify-between py-2 border-b border-cream last:border-0">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {formatCurrency(h.amount_sent, 'SGD')} → ₹{Math.round(h.amount_sent * h.rate_used).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-ink-3">
                      {h.provider} · Rate: {h.rate_used?.toFixed(2)} · {new Date(h.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <TabBar active="home" />
    </div>
  )
}
