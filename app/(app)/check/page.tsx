'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  ClipboardList,
  Plane,
  ShoppingBag,
  Sparkles,
  Utensils,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { calculateSafeToSpend, formatCurrency } from '@/lib/calculations'
import { getMoneyCheckIntro } from '@/lib/personalization'
import { Profile, SafeToSpendData } from '@/types'
import TabBar from '@/components/ui/TabBar'

const QUICK_CHECKS: Array<{ label: string; icon: LucideIcon; amount: number }> = [
  { label: 'Dinner out', icon: Utensils, amount: 30 },
  { label: 'Weekend trip', icon: Plane, amount: 200 },
  { label: 'Shopping', icon: ShoppingBag, amount: 100 },
  { label: 'Big bill', icon: ClipboardList, amount: 500 },
]

export default function CheckPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [safeData, setSafeData] = useState<SafeToSpendData | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'afford' | 'impulse' | 'whatif'>('afford')

  // Afford check
  const [amount, setAmount] = useState('')
  const [item, setItem] = useState('')
  const [affordResult, setAffordResult] = useState('')
  const [checking, setChecking] = useState(false)

  // Impulse check
  const [impulseItem, setImpulseItem] = useState('')
  const [impulseAmount, setImpulseAmount] = useState('')
  const [impulseResult, setImpulseResult] = useState('')
  const [impulseDecision, setImpulseDecision] = useState<'wait' | 'buy' | null>(null)

  // What-if
  const [whatifAction, setWhatifAction] = useState('')
  const [whatifResult, setWhatifResult] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const [profileRes, entriesRes, fixedRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('budget_entries').select('*').eq('user_id', user.id),
        supabase.from('fixed_spending').select('*').eq('user_id', user.id).eq('is_active', true),
      ])

      if (profileRes.data) {
        const loadedProfile = profileRes.data as Profile
        setProfile(loadedProfile)
        const safe = calculateSafeToSpend(loadedProfile, entriesRes.data || [], fixedRes.data || [])
        setSafeData(safe)
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleAffordCheck = async (checkAmount?: number, checkItem?: string) => {
    const a = checkAmount || parseFloat(amount)
    const i = checkItem || item
    if (!a || !safeData) return
    setChecking(true)
    setAffordResult('')

    try {
      const response = await fetch('/api/sarathy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Can I afford ${i || 'this'} for ${formatCurrency(a, safeData.currency)}?`,
          isAnxious: false,
          context: {
            name: profile?.name,
            companion_vibe: profile?.companion_vibe || 'calm_mentor',
            currency: safeData.currency,
            planning_amount: profile?.planning_amount,
            spent: safeData.alreadySpent,
            safe_today: safeData.safeToSpend,
            days_remaining: safeData.daysLeft,
            status: safeData.status,
            money_fear: profile?.money_fear,
            responsible_for: profile?.responsible_for,
            streak: profile?.daily_login_streak,
          },
          history: [],
        }),
      })
      const data = await response.json()
      setAffordResult(data.message)
    } catch {
      setAffordResult('Having trouble connecting. Try again in a moment.')
    } finally { setChecking(false) }
  }

  const handleImpulseCheck = async () => {
    if (!impulseItem || !impulseAmount || !safeData) return
    setChecking(true)
    setImpulseResult('')
    setImpulseDecision(null)

    try {
      const response = await fetch('/api/sarathy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `I want to buy ${impulseItem} for ${formatCurrency(parseFloat(impulseAmount), safeData.currency)}. Is this a good idea right now? Give me an honest 30-second reality check.`,
          isAnxious: false,
          context: {
            name: profile?.name,
            companion_vibe: profile?.companion_vibe || 'calm_mentor',
            currency: safeData.currency,
            planning_amount: profile?.planning_amount,
            spent: safeData.alreadySpent,
            safe_today: safeData.safeToSpend,
            days_remaining: safeData.daysLeft,
            status: safeData.status,
            money_fear: profile?.money_fear,
            responsible_for: profile?.responsible_for,
            streak: profile?.daily_login_streak,
          },
          history: [],
        }),
      })
      const data = await response.json()
      setImpulseResult(data.message)
    } catch {
      setImpulseResult('Having trouble connecting. Try again.')
    } finally { setChecking(false) }
  }

  const handleImpulseDecision = async (decision: 'wait' | 'buy') => {
    setImpulseDecision(decision)
    if (decision === 'wait') {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles').update({ total_xp: (profile?.total_xp || 0) + 30 }).eq('id', user.id)
      }
    }
  }

  const handleWhatIf = async () => {
    if (!whatifAction || !safeData) return
    setChecking(true)
    setWhatifResult('')

    try {
      const response = await fetch('/api/sarathy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `What if ${whatifAction}? How would that affect my finances this month?`,
          isAnxious: false,
          context: {
            name: profile?.name,
            companion_vibe: profile?.companion_vibe || 'calm_mentor',
            currency: safeData.currency,
            planning_amount: profile?.planning_amount,
            spent: safeData.alreadySpent,
            safe_today: safeData.safeToSpend,
            days_remaining: safeData.daysLeft,
            status: safeData.status,
            money_fear: profile?.money_fear,
            responsible_for: profile?.responsible_for,
            streak: profile?.daily_login_streak,
          },
          history: [],
        }),
      })
      const data = await response.json()
      setWhatifResult(data.message)
    } catch {
      setWhatifResult('Having trouble connecting. Try again.')
    } finally { setChecking(false) }
  }

  if (loading) return (
    <div className="min-h-dvh bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const currency = safeData?.currency || 'SGD'
  const intro = getMoneyCheckIntro(profile, safeData)

  return (
    <div className="min-h-dvh bg-cream pb-24">
      <div className="px-5 pt-12 pb-4">
        <h1 className="font-fraunces text-2xl font-semibold text-ink mb-1">{intro.title}</h1>
        <p className="text-ink-3 text-sm">{intro.subtitle}</p>
      </div>

      {/* Mode tabs */}
      <div className="px-5 mb-5">
        <div className="flex bg-white rounded-2xl p-1 shadow-sm">
          {[
            { id: 'afford', label: 'Can I afford?' },
            { id: 'impulse', label: 'Pause & think' },
            { id: 'whatif', label: 'What if...' },
          ].map(m => (
            <button key={m.id} onClick={() => setMode(m.id as any)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${mode === m.id ? 'bg-saffron text-white' : 'text-ink-3'}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5">

        {/* AFFORD CHECK */}
        {mode === 'afford' && (
          <>
            <div className="card mb-4">
              <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-3">Quick checks</p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_CHECKS.map(q => {
                  const Icon = q.icon
                  return (
                  <button key={q.label} onClick={() => { setItem(q.label); setAmount(q.amount.toString()); handleAffordCheck(q.amount, q.label) }}
                    className="flex items-center gap-2 p-3 rounded-xl bg-cream active:bg-saffron-soft transition-colors text-left">
                    <Icon className="h-5 w-5 flex-shrink-0 text-saffron" />
                    <div>
                      <p className="text-xs font-medium text-ink">{q.label}</p>
                      <p className="text-xs text-ink-3">{formatCurrency(q.amount, currency)}</p>
                    </div>
                  </button>
                  )
                })}
              </div>
            </div>

            <div className="card mb-4">
              <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-3">Custom check</p>
              <input type="text" value={item} onChange={e => setItem(e.target.value)}
                placeholder="What do you want to buy?" className="input-field mb-3" />
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="How much?" className="input-field mb-3" inputMode="decimal" />
              <button onClick={() => handleAffordCheck()} className="btn-primary" disabled={checking || !amount}>
                {checking ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Ask Sarathy'}
              </button>
            </div>

            {affordResult && (
              <div className="card border-l-4 border-saffron">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-saffron" />
                  <p className="text-sm text-ink leading-relaxed">{affordResult}</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* IMPULSE CHECK */}
        {mode === 'impulse' && (
          <>
            <div className="card mb-4 border-l-4 border-warning">
              <p className="text-sm font-medium text-ink mb-1">{intro.impulseTitle}</p>
              <p className="text-xs text-ink-3">{intro.impulseBody}</p>
            </div>

            {!impulseDecision ? (
              <>
                <div className="card mb-4">
                  <input type="text" value={impulseItem} onChange={e => setImpulseItem(e.target.value)}
                    placeholder="What do you want to buy?" className="input-field mb-3" />
                  <input type="number" value={impulseAmount} onChange={e => setImpulseAmount(e.target.value)}
                    placeholder="How much?" className="input-field mb-3" inputMode="decimal" />
                  <button onClick={handleImpulseCheck} className="btn-primary" disabled={checking || !impulseItem || !impulseAmount}>
                    {checking ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Get honest reality check'}
                  </button>
                </div>

                {impulseResult && (
                  <>
                    <div className="card border-l-4 border-saffron mb-4">
                      <div className="flex items-start gap-2">
                        <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-saffron" />
                        <p className="text-sm text-ink leading-relaxed">{impulseResult}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => handleImpulseDecision('wait')}
                        className="flex-1 py-3 rounded-xl bg-safe text-white font-medium text-sm">
                        I'll wait +30 XP
                      </button>
                      <button onClick={() => handleImpulseDecision('buy')}
                        className="flex-1 py-3 rounded-xl bg-cream text-ink font-medium text-sm border border-gray-200">
                        I'll buy it
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="card text-center py-8">
                {impulseDecision === 'wait' ? (
                  <>
                    <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-safe" />
                    <p className="font-fraunces text-xl font-semibold text-ink mb-1">Nice one!</p>
                    <p className="text-ink-3 text-sm mb-2">+30 XP earned for pausing.</p>
                    <p className="text-ink-3 text-sm">Come back in 24 hours. If you still want it, it may be worth it.</p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-saffron" />
                    <p className="font-fraunces text-xl font-semibold text-ink mb-1">Decision made!</p>
                    <p className="text-ink-3 text-sm">Don't forget to log it when you buy.</p>
                  </>
                )}
                <button onClick={() => { setImpulseDecision(null); setImpulseResult(''); setImpulseItem(''); setImpulseAmount('') }}
                  className="btn-secondary mt-4">Check something else</button>
              </div>
            )}
          </>
        )}

        {/* WHAT IF */}
        {mode === 'whatif' && (
          <>
            <div className="card mb-4">
              <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-3">Try a scenario</p>
              <div className="flex flex-col gap-2 mb-4">
                {[
                  'I cook at home 3 times this week',
                  'I skip takeaway for 2 weeks',
                  'I cancel one subscription',
                  'I walk instead of taking transport this week',
                ].map(s => (
                  <button key={s} onClick={() => setWhatifAction(s)}
                    className={`text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${whatifAction === s ? 'bg-saffron text-white' : 'bg-cream text-ink'}`}>
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-3 mb-2">Or type your own:</p>
              <input type="text" value={whatifAction} onChange={e => setWhatifAction(e.target.value)}
                placeholder="What if I..." className="input-field mb-3" />
              <button onClick={handleWhatIf} className="btn-primary" disabled={checking || !whatifAction}>
                {checking ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Show me the impact'}
              </button>
            </div>

            {whatifResult && (
              <div className="card border-l-4 border-saffron">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-saffron" />
                  <p className="text-sm text-ink leading-relaxed">{whatifResult}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <TabBar active="home" />
    </div>
  )
}
