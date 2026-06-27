'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  HeartHandshake,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trophy,
  TrendingDown,
  TrendingUp,
  Utensils,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatCurrency, groupEntriesByCategory, getMonthEntries } from '@/lib/calculations'
import { getInsightsIntro } from '@/lib/personalization'
import TabBar from '@/components/ui/TabBar'

type Persona = {
  name: string
  icon: LucideIcon
  desc: string
}

export default function InsightsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [moodLogs, setMoodLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [aiInsight, setAiInsight] = useState('')
  const [insightLoading, setInsightLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const [pRes, eRes, mRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('budget_entries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('mood_logs').select('*').eq('user_id', user.id).order('entry_date', { ascending: false }).limit(30),
      ])
      if (pRes.data) setProfile(pRes.data)
      setEntries(eRes.data || [])
      setMoodLogs(mRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const getPersona = (): Persona => {
    if (!entries.length) return { name: 'Just getting started', icon: Sparkles, desc: 'Keep logging to discover your money personality' }
    const cats = groupEntriesByCategory(entries)
    const top = cats[0]?.category
    const anxious = moodLogs.filter(m => m.mood === 'anxious' || m.mood === 'stressed').length
    const total = moodLogs.length
    if (anxious / Math.max(total, 1) > 0.5) return { name: 'The Anxious Achiever', icon: ShieldCheck, desc: 'You care deeply about money. Your awareness is your biggest strength.' }
    if (top === 'Food') return { name: 'The Comfort Spender', icon: Utensils, desc: 'Food is your happy place. You spend on experiences with people you love.' }
    if (top === 'Family') return { name: 'The Family Guardian', icon: HeartHandshake, desc: 'You put people before things. That is rare and worth protecting.' }
    if (top === 'Shopping') return { name: 'The Visionary Spender', icon: ShoppingBag, desc: 'You invest in yourself and things that make life better.' }
    return { name: 'The Quiet Champion', icon: Trophy, desc: 'Steady, consistent, reliable. You are building something real.' }
  }

  const getTrend = () => {
    const now = new Date()
    const thisMonth = entries.filter(e => { const d = new Date(e.entry_date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
    const lastMonth = entries.filter(e => { const d = new Date(e.entry_date); const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear() })
    const t = thisMonth.reduce((s, e) => s + e.amount, 0)
    const l = lastMonth.reduce((s, e) => s + e.amount, 0)
    if (!l) return null
    return { diff: Math.round(((t - l) / l) * 100), thisTotal: t, lastTotal: l }
  }

  const getPattern = () => {
    const anxiousDays = moodLogs.filter(m => m.mood === 'anxious' || m.mood === 'stressed').map((m: any) => m.entry_date)
    const dailySpend: Record<string, number> = {}
    entries.forEach(e => { dailySpend[e.entry_date] = (dailySpend[e.entry_date] || 0) + e.amount })
    const avg = Object.values(dailySpend).reduce((s, v) => s + v, 0) / Math.max(Object.keys(dailySpend).length, 1)
    const anxiousHigh = anxiousDays.filter((d: string) => (dailySpend[d] || 0) > avg * 1.3).length
    return { anxiousHigh, totalAnxious: anxiousDays.length }
  }

  const generateInsight = async () => {
    setInsightLoading(true)
    try {
      const res = await fetch('/api/sarathy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Based on my financial data, give me one powerful insight about my money behavior that I probably do not know about myself. Be specific, warm, and honest.',
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
      setAiInsight(data.message)
    } catch { setAiInsight('') }
    finally { setInsightLoading(false) }
  }

  if (loading) return (
    <div className="min-h-dvh bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const persona = getPersona()
  const trend = getTrend()
  const pattern = getPattern()
  const cats = groupEntriesByCategory(getMonthEntries(entries))
  const currency = profile?.primary_currency || 'SGD'
  const intro = getInsightsIntro(profile)
  const PersonaIcon = persona.icon

  return (
    <div className="min-h-dvh bg-cream pb-24">
      <div className="px-5 pt-12 pb-4">
        <h1 className="font-fraunces text-2xl font-semibold text-ink mb-1">{intro.title}</h1>
        <p className="text-ink-3 text-sm">{intro.subtitle}</p>
      </div>
      <div className="px-5 flex flex-col gap-4">
        <div className="bg-gradient-to-br from-plum to-plum-2 rounded-2xl p-5 text-white">
          <p className="text-xs font-medium opacity-60 mb-2 uppercase tracking-wide">Your money personality</p>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/12">
              <PersonaIcon className="h-5 w-5" />
            </div>
            <p className="font-fraunces text-xl font-semibold">{persona.name}</p>
          </div>
          <p className="text-sm opacity-80 leading-relaxed">{persona.desc}</p>
          <p className="text-xs opacity-50 mt-3">{entries.length} transactions analysed</p>
        </div>

        {trend && (
          <div className="card">
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-3">Month vs last month</p>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-1 text-2xl font-fraunces font-semibold ${trend.diff > 0 ? 'text-danger' : 'text-safe'}`}>
                {trend.diff > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                {Math.abs(trend.diff)}%
              </div>
              <div>
                <p className="text-sm text-ink">{trend.diff > 0 ? 'Spending more' : 'Spending less'} than last month</p>
                <p className="text-xs text-ink-3">{formatCurrency(trend.thisTotal, currency)} vs {formatCurrency(trend.lastTotal, currency)}</p>
              </div>
            </div>
          </div>
        )}

        {cats.length > 0 && (
          <div className="card">
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-3">Where your money goes</p>
            <div className="flex flex-col gap-2">
              {cats.slice(0, 5).map((cat: any) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-medium text-ink">{cat.category}</span>
                      <span className="text-xs text-ink-3">{cat.percentage}%</span>
                    </div>
                    <div className="h-1.5 bg-cream-3 rounded-full">
                      <div className="h-1.5 bg-saffron rounded-full" style={{ width: `${cat.percentage}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-ink w-16 text-right">{formatCurrency(cat.total, currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {pattern.totalAnxious > 0 && (
          <div className="card border-l-4 border-warning">
            <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2">Mood x money</p>
            {pattern.anxiousHigh > 0 ? (
              <>
                <p className="text-sm font-medium text-ink mb-1">You spend more when anxious</p>
                <p className="text-xs text-ink-3">On {pattern.anxiousHigh} anxious days you spent above average. This is common, and now you can plan for it.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-ink mb-1">Anxiety does not drive your spending</p>
                <p className="text-xs text-ink-3">Even on stressed days your spending stays consistent. That is real discipline.</p>
              </>
            )}
          </div>
        )}

        <div className="card">
          <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-3">Sarathy insight</p>
          {aiInsight ? (
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-saffron" />
              <p className="text-sm text-ink leading-relaxed">{aiInsight}</p>
            </div>
          ) : (
            <button onClick={generateInsight} className="btn-primary" disabled={insightLoading || entries.length < 3}>
              {insightLoading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : entries.length < 3 ? 'Log 3+ expenses to unlock' : 'Get my personal insight'}
            </button>
          )}
        </div>
      </div>
      <TabBar active="story" />
    </div>
  )
}
