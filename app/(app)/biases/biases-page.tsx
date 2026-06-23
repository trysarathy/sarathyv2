'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/calculations'
import TabBar from '@/components/ui/TabBar'

interface Bias {
  id: string
  name: string
  emoji: string
  found: boolean
  evidence: string
  what: string
  action: string
  severity: 'high' | 'medium' | 'low'
}

export default function BiasesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [moodLogs, setMoodLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [biases, setBiases] = useState<Bias[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const [pRes, eRes, mRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('budget_entries').select('*').eq('user_id', user.id).order('entry_date'),
        supabase.from('mood_logs').select('*').eq('user_id', user.id).order('entry_date'),
      ])
      if (pRes.data) {
        setProfile(pRes.data)
        detectBiases(eRes.data || [], mRes.data || [], pRes.data)
      }
      setEntries(eRes.data || [])
      setMoodLogs(mRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const detectBiases = (entries: any[], moods: any[], prof: any) => {
    const detected: Bias[] = []
    const dailySpend: Record<string, number> = {}
    entries.forEach(e => { dailySpend[e.entry_date] = (dailySpend[e.entry_date] || 0) + e.amount })
    const avgDaily = Object.values(dailySpend).reduce((s: any, v: any) => s + v, 0) / Math.max(Object.keys(dailySpend).length, 1)

    // 1. Emotional spending
    const anxiousDays = moods.filter(m => m.mood === 'anxious' || m.mood === 'stressed').map(m => m.entry_date)
    const anxiousHighSpend = anxiousDays.filter(d => (dailySpend[d] || 0) > avgDaily * 1.3)
    const emotionalRatio = anxiousDays.length > 0 ? anxiousHighSpend.length / anxiousDays.length : 0

    detected.push({
      id: 'emotional',
      name: 'Emotional spending',
      emoji: '😰',
      found: emotionalRatio > 0.3 && anxiousDays.length >= 2,
      evidence: emotionalRatio > 0.3 && anxiousDays.length >= 2
        ? `On ${anxiousHighSpend.length} of your ${anxiousDays.length} anxious days, you spent more than usual. This is one of the most common patterns in behavioral finance.`
        : `You've logged ${anxiousDays.length} anxious day${anxiousDays.length !== 1 ? 's' : ''}. Your spending stays controlled even when stressed. That's real emotional discipline.`,
      what: "Emotional spending happens when stress triggers purchases for temporary comfort. Research shows 62% of Gen Z experience this pattern — it's not a character flaw, it's a brain response.",
      action: "Next time you feel anxious, tap 'I'm anxious' before any purchase. Sarathy will show you why you're safer than you feel — and that alone reduces the urge to spend.",
      severity: emotionalRatio > 0.5 ? 'high' : 'medium',
    })

    // 2. Present bias
    const highSpendEarlyMonth = entries.filter(e => {
      const d = new Date(e.entry_date)
      return d.getDate() <= 5 && e.amount > avgDaily * 1.5
    })
    detected.push({
      id: 'present',
      name: 'Payday splurge (present bias)',
      emoji: '⏰',
      found: highSpendEarlyMonth.length > 2,
      evidence: highSpendEarlyMonth.length > 2
        ? `${highSpendEarlyMonth.length} high-spend days detected in the first 5 days of the month — a classic payday splurge pattern.`
        : 'Your spending is consistent throughout the month — no payday splurge pattern detected.',
      what: "Present bias is why people overspend right after payday. The brain treats available money as 'free' money, making future obligations feel distant and abstract.",
      action: "Decide your 'first week budget' at the start of each month — before the money lands. Pre-commitment beats willpower every time.",
      severity: 'medium',
    })

    // 3. Financial avoidance
    const now = new Date()
    const recentEntries = entries.filter(e => {
      const d = new Date(e.entry_date)
      return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= 7
    })
    const avoidance = recentEntries.length === 0 && entries.length > 5
    detected.push({
      id: 'avoidance',
      name: 'Financial avoidance',
      emoji: '👀',
      found: avoidance,
      evidence: avoidance
        ? 'No entries logged in the last 7 days. You may be avoiding checking your finances — which is when anxiety tends to grow fastest.'
        : `${recentEntries.length} entries logged in the last 7 days — great consistency.`,
      what: "Financial avoidance happens when checking money feels more painful than not knowing. Research consistently shows avoidance increases anxiety over time. The number in your head is almost always worse than the real one.",
      action: "Open Sarathy every morning for just 10 seconds — safe-to-spend number, nothing else. The habit of looking is the cure.",
      severity: avoidance ? 'high' : 'low',
    })

    // 4. Category fragmentation
    const uniqueCats = [...new Set(entries.map(e => e.category))]
    detected.push({
      id: 'choice',
      name: 'Too many categories',
      emoji: '🗂️',
      found: uniqueCats.length > 7,
      evidence: uniqueCats.length > 7
        ? `You're using ${uniqueCats.length} categories — this creates cognitive overload and makes it harder to see patterns.`
        : `${uniqueCats.length} categories — clean and clear.`,
      what: "Choice overload from too many categories makes financial awareness harder. Behavioral research shows 5-6 categories is the sweet spot — enough to track, simple enough to understand at a glance.",
      action: "Consolidate to 5: Food, Transport, Social, Home, Family. Everything else becomes Other. Less granularity, more clarity.",
      severity: uniqueCats.length > 7 ? 'low' : 'low',
    })

    setBiases(detected)
  }

  if (loading) return (
    <div className="min-h-dvh bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const foundBiases = biases.filter(b => b.found && b.severity !== 'low')

  return (
    <div className="min-h-dvh bg-cream pb-24">
      <div className="px-5 pt-12 pb-4">
        <h1 className="font-fraunces text-2xl font-semibold text-ink mb-1">Your money psychology</h1>
        <p className="text-ink-3 text-sm">Behavioral patterns in your real data</p>
      </div>

      <div className="mx-5 mb-4 bg-saffron-soft rounded-2xl p-4">
        <p className="text-xs text-ink leading-relaxed">
          🧠 <span className="font-medium">Why this matters:</span> Research shows 62% of Gen Z feel financial anxiety every week. This isn't about math skills — it's about psychology. These patterns are human. Naming them is the first step.
        </p>
      </div>

      {entries.length < 5 ? (
        <div className="px-5">
          <div className="card text-center py-8">
            <p className="text-3xl mb-3">🌱</p>
            <p className="font-medium text-ink mb-1">Log 5+ expenses to unlock</p>
            <p className="text-ink-3 text-sm">Sarathy needs enough data to detect real patterns accurately.</p>
          </div>
        </div>
      ) : (
        <div className="px-5 flex flex-col gap-3">
          <div className="card">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${foundBiases.length === 0 ? 'bg-green-50' : 'bg-saffron-soft'}`}>
                {foundBiases.length === 0 ? '✅' : '🔍'}
              </div>
              <div>
                <p className="font-semibold text-ink">
                  {foundBiases.length === 0 ? 'No strong patterns detected' : `${foundBiases.length} pattern${foundBiases.length > 1 ? 's' : ''} found`}
                </p>
                <p className="text-xs text-ink-3">Tap each one to understand it and get one action</p>
              </div>
            </div>
          </div>

          {biases.map(bias => (
            <button
              key={bias.id}
              onClick={() => setExpanded(expanded === bias.id ? null : bias.id)}
              className={`card text-left w-full ${
                bias.found && bias.severity === 'high' ? 'border-l-4 border-danger' :
                bias.found && bias.severity === 'medium' ? 'border-l-4 border-warning' :
                'border-l-4 border-safe'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-2xl">{bias.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-ink text-sm">{bias.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        bias.found && bias.severity !== 'low' ? 'bg-red-50 text-danger' : 'bg-green-50 text-safe'
                      }`}>
                        {bias.found && bias.severity !== 'low' ? 'Detected' : 'Not detected'}
                      </span>
                    </div>
                    <p className="text-xs text-ink-3 mt-1 leading-relaxed">{bias.evidence}</p>
                  </div>
                </div>
                <span className="text-ink-3 ml-2 flex-shrink-0">{expanded === bias.id ? '↑' : '↓'}</span>
              </div>

              {expanded === bias.id && (
                <div className="mt-4 pt-4 border-t border-cream-3">
                  <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2">What is this?</p>
                  <p className="text-sm text-ink leading-relaxed mb-4">{bias.what}</p>
                  <div className="bg-saffron-soft rounded-xl p-3">
                    <p className="text-xs font-medium text-saffron mb-1">One action 🌸</p>
                    <p className="text-sm text-ink leading-relaxed">{bias.action}</p>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <TabBar active="story" />
    </div>
  )
}
