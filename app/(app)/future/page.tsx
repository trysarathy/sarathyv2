'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { formatCurrency, groupEntriesByCategory } from '@/lib/calculations'
import TabBar from '@/components/ui/TabBar'

export default function FuturePage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [goals, setGoals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scenario, setScenario] = useState<'current'|'one'|'two'>('current')
  const [aiNarrative, setAiNarrative] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const [pRes, eRes, gRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('budget_entries').select('*').eq('user_id', user.id),
        supabase.from('goals').select('*').eq('user_id', user.id),
      ])
      if (pRes.data) setProfile(pRes.data)
      setEntries(eRes.data || [])
      setGoals(gRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const getProjection = () => {
    if (!profile?.planning_amount) return null
    const now = new Date()
    const monthsToProject = 6
    const cats = groupEntriesByCategory(entries)
    const monthlySpend = entries
      .filter(e => {
        const d = new Date(e.entry_date)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      .reduce((s, e) => s + e.amount, 0)

    const topCat = cats[0]
    const topCatMonthly = topCat?.total || 0
    const savingsPerMonth = Math.max(0, profile.planning_amount - monthlySpend)

    // Scenario 1: one small change (cut top category by 20%)
    const saving1 = topCatMonthly * 0.20
    const savingsScenario1 = savingsPerMonth + saving1

    // Scenario 2: two changes (cut top 2 categories by 20%)
    const secondCat = cats[1]
    const saving2 = (secondCat?.total || 0) * 0.20
    const savingsScenario2 = savingsPerMonth + saving1 + saving2

    const topGoal = goals[0]

    return {
      current: {
        saved: savingsPerMonth * monthsToProject,
        monthly: savingsPerMonth,
        label: 'If nothing changes',
      },
      one: {
        saved: savingsScenario1 * monthsToProject,
        monthly: savingsScenario1,
        saving: saving1,
        change: `Spend 20% less on ${topCat?.category || 'your top category'}`,
        label: 'One small change',
      },
      two: {
        saved: savingsScenario2 * monthsToProject,
        monthly: savingsScenario2,
        saving: saving1 + saving2,
        change: `Also cut ${secondCat?.category || 'second category'} by 20%`,
        label: 'Two changes',
      },
      topGoal,
      topCat,
      months: monthsToProject,
    }
  }

  const getGoalImpact = (savedAmount: number) => {
    if (!goals.length) return null
    const goal = goals[0]
    const remaining = goal.target_amount - goal.current_amount
    const monthsToGoal = remaining > 0 ? Math.ceil(remaining / (savedAmount / 6)) : 0
    const pct = Math.min(100, Math.round((savedAmount / remaining) * 100))
    return { goal, pct, monthsToGoal }
  }

  const generateNarrative = async (proj: any) => {
    if (!proj) return
    setAiLoading(true)
    const chosen = proj[scenario]
    try {
      const res = await fetch('/api/sarathy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Show me what my financial life looks like in 6 months in the "${chosen.label}" scenario. I would save ${formatCurrency(chosen.saved, profile?.primary_currency || 'SGD')} total. Make it feel real and personal, not abstract. Reference my actual goals if relevant.`,
          isAnxious: false,
          context: {
            name: profile?.name,
            companion_vibe: profile?.companion_vibe || 'calm_mentor',
            currency: profile?.primary_currency || 'SGD',
            planning_amount: profile?.planning_amount,
            spent: entries.reduce((s, e) => s + e.amount, 0),
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
      setAiNarrative(data.message)
    } catch { setAiNarrative('') }
    finally { setAiLoading(false) }
  }

  if (loading) return (
    <div className="min-h-dvh bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const proj = getProjection()
  const currency = profile?.primary_currency || 'SGD'

  if (!proj) return (
    <div className="min-h-dvh bg-cream px-5 pt-12">
      <h1 className="font-fraunces text-2xl font-semibold text-ink mb-3">Future you</h1>
      <div className="card text-center py-8">
        <p className="text-3xl mb-3">🌱</p>
        <p className="font-medium text-ink mb-1">Set your budget first</p>
        <p className="text-ink-3 text-sm">Complete onboarding to see your future scenarios</p>
      </div>
      <TabBar active="story" />
    </div>
  )

  const scenarios = [
    { key: 'current', label: 'If nothing changes', emoji: '📊', data: proj.current },
    { key: 'one', label: 'One small change', emoji: '✨', data: proj.one },
    { key: 'two', label: 'Two changes', emoji: '🚀', data: proj.two },
  ] as const

  return (
    <div className="min-h-dvh bg-cream pb-24">
      <div className="px-5 pt-12 pb-4">
        <h1 className="font-fraunces text-2xl font-semibold text-ink mb-1">Future you</h1>
        <p className="text-ink-3 text-sm">6 months from now — three versions of your financial life</p>
      </div>

      <div className="px-5 flex flex-col gap-4">

        {/* Scenario selector */}
        <div className="flex flex-col gap-2">
          {scenarios.map(s => {
            const impact = getGoalImpact((s.data as any).saved)
            const isSelected = scenario === s.key
            return (
              <button
                key={s.key}
                onClick={() => { setScenario(s.key as any); setAiNarrative('') }}
                className={`p-4 rounded-2xl text-left transition-all border-2 ${
                  isSelected ? 'border-saffron bg-saffron-soft' : 'border-transparent bg-white shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{s.emoji}</span>
                    <p className="font-semibold text-ink text-sm">{s.label}</p>
                  </div>
                  <p className={`font-fraunces text-xl font-semibold ${
                    s.key === 'current' ? 'text-ink-3' :
                    s.key === 'one' ? 'text-warning' : 'text-safe'
                  }`}>
                    {formatCurrency((s.data as any).saved, currency)}
                  </p>
                </div>

                {(s.data as any).change && (
                  <p className="text-xs text-ink-3 mb-1">
                    💡 {(s.data as any).change}
                    {(s.data as any).saving > 0 && (
                      <span className="text-safe font-medium"> · saves {formatCurrency((s.data as any).saving, currency)}/mo</span>
                    )}
                  </p>
                )}

                {impact && impact.pct > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-ink-3">
                      {impact.goal.emoji} {impact.goal.name}:
                      <span className={`font-medium ml-1 ${impact.pct >= 100 ? 'text-safe' : 'text-saffron'}`}>
                        {impact.pct >= 100 ? '✅ Fully funded!' : `${impact.pct}% funded`}
                      </span>
                    </p>
                    {impact.pct < 100 && (
                      <p className="text-xs text-ink-3">Done in ~{impact.monthsToGoal} months</p>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Real cost translator */}
        {proj.topCat && (
          <div className="card border-l-4 border-saffron">
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2">The real cost</p>
            <p className="text-sm font-medium text-ink mb-1">
              Your {proj.topCat.category} spending this month
            </p>
            <p className="font-fraunces text-2xl font-semibold text-ink mb-2">
              {formatCurrency(proj.topCat.total, currency)}
            </p>
            {profile?.home_country === 'India' || profile?.secondary_currency === 'INR' ? (
              <p className="text-xs text-ink-3">
                That's ₹{Math.round(proj.topCat.total * 62).toLocaleString('en-IN')} — about {Math.round(proj.topCat.total * 62 / 3500)} weeks of groceries back home
              </p>
            ) : (
              <p className="text-xs text-ink-3">
                That's {Math.round(proj.topCat.total / 12)} days of daily spending, or {Math.round((proj.topCat.total / (profile?.planning_amount || 1)) * 100)}% of your monthly budget
              </p>
            )}
          </div>
        )}

        {/* Sarathy narrative */}
        <div className="card">
          <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-3">
            Sarathy's story of your future
          </p>
          {aiNarrative ? (
            <div className="flex items-start gap-2">
              <span className="text-lg">🌸</span>
              <p className="text-sm text-ink leading-relaxed">{aiNarrative}</p>
            </div>
          ) : (
            <button
              onClick={() => generateNarrative(proj)}
              className="btn-primary"
              disabled={aiLoading}
            >
              {aiLoading
                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : 'Show me my future 🌸'}
            </button>
          )}
        </div>

      </div>

      <TabBar active="story" />
    </div>
  )
}
