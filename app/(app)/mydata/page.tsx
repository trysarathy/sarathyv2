'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, LockKeyhole, Sprout } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatCurrency, groupEntriesByCategory, getMonthEntries } from '@/lib/calculations'
import { getFirstName, getProfileSummary } from '@/lib/personalization'
import TabBar from '@/components/ui/TabBar'

export default function MyDataPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [moodLogs, setMoodLogs] = useState<any[]>([])
  const [goals, setGoals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'profile' | 'behaviour' | 'benchmark'>('profile')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const [pRes, eRes, mRes, gRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('budget_entries').select('*').eq('user_id', user.id).order('entry_date'),
        supabase.from('mood_logs').select('*').eq('user_id', user.id).order('entry_date'),
        supabase.from('goals').select('*').eq('user_id', user.id),
      ])
      if (pRes.data) setProfile(pRes.data)
      setEntries(eRes.data || [])
      setMoodLogs(mRes.data || [])
      setGoals(gRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const getBehaviouralProfile = () => {
    const cats = groupEntriesByCategory(entries)
    const topCat = cats[0]
    const totalSpend = entries.reduce((s, e) => s + e.amount, 0)
    const avgTransaction = entries.length > 0 ? totalSpend / entries.length : 0
    const anxiousDays = moodLogs.filter(m => m.mood === 'anxious' || m.mood === 'stressed').length
    const goodDays = moodLogs.filter(m => m.mood === 'good').length
    const dailySpend: Record<string, number> = {}
    entries.forEach(e => { dailySpend[e.entry_date] = (dailySpend[e.entry_date] || 0) + e.amount })
    const avgDaily = Object.keys(dailySpend).length > 0
      ? Object.values(dailySpend).reduce((s, v) => s + v, 0) / Object.keys(dailySpend).length
      : 0
    const anxiousHighSpend = moodLogs
      .filter(m => m.mood === 'anxious' || m.mood === 'stressed')
      .filter(m => (dailySpend[m.entry_date] || 0) > avgDaily * 1.3).length

    return {
      topCat: topCat?.category || 'Not enough data',
      topCatPct: topCat?.percentage || 0,
      totalTransactions: entries.length,
      avgTransaction: Math.round(avgTransaction),
      anxiousDays,
      goodDays,
      emotionalSpender: anxiousDays > 0 && (anxiousHighSpend / anxiousDays) > 0.3,
      streak: profile?.daily_login_streak || 0,
      totalXP: profile?.total_xp || 0,
      goalsSet: goals.length,
    }
  }

  // Anonymised benchmarks based on typical Singapore student data
  const getBenchmarks = () => {
    const currency = profile?.primary_currency || 'SGD'
    const monthEntries = getMonthEntries(entries)
    const myMonthSpend = monthEntries.reduce((s, e) => s + e.amount, 0)
    const cats = groupEntriesByCategory(monthEntries)
    const myFood = cats.find(c => c.category === 'Food')?.total || 0
    const myTransport = cats.find(c => c.category === 'Transport')?.total || 0

    return [
      {
        label: 'Monthly food spend',
        mine: myFood,
        avg: 280,
        unit: currency,
        insight: myFood < 280
          ? 'You spend less on food than the average Singapore student.'
          : myFood < 400
          ? 'Your food spend is close to average. No alarm bells.'
          : 'Food is your biggest opportunity to save vs peers',
      },
      {
        label: 'Monthly transport spend',
        mine: myTransport,
        avg: 95,
        unit: currency,
        insight: myTransport < 95
          ? 'Below average transport spend. Well managed.'
          : 'Slightly above average. Consider MRT over Grab where possible.',
      },
      {
        label: 'Total monthly spend',
        mine: myMonthSpend,
        avg: 850,
        unit: currency,
        insight: myMonthSpend < 850
          ? 'You spend less than the average international student in Singapore'
          : myMonthSpend < 1200
          ? 'In line with typical student spending in Singapore'
          : 'Above average monthly spend. Worth reviewing your fixed costs.',
      },
      {
        label: 'Streak (days)',
        mine: profile?.daily_login_streak || 0,
        avg: 4,
        unit: 'days',
        insight: (profile?.daily_login_streak || 0) >= 4
          ? 'Your check-in habit is stronger than average. That consistency pays off.'
          : 'Building the daily check-in habit takes 2-3 weeks. Keep going.',
      },
    ]
  }

  if (loading) return (
    <div className="min-h-dvh bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const behaviour = getBehaviouralProfile()
  const benchmarks = getBenchmarks()
  const currency = profile?.primary_currency || 'SGD'
  const firstName = getFirstName(profile)
  const summary = getProfileSummary(profile)

  return (
    <div className="min-h-dvh bg-cream pb-24">
      <div className="px-5 pt-12 pb-4">
        <h1 className="font-fraunces text-2xl font-semibold text-ink mb-1">
          {firstName}'s data
        </h1>
        <p className="text-ink-3 text-sm">
          Everything Sarathy uses to personalize the app. {summary.note}
        </p>
      </div>

      {/* Privacy note */}
      <div className="mx-5 mb-4 bg-saffron-soft rounded-2xl p-4">
        <div className="flex items-start gap-2">
          <LockKeyhole className="mt-0.5 h-4 w-4 flex-shrink-0 text-saffron" />
          <p className="text-xs text-ink leading-relaxed">
            <span className="font-medium">Your data, your rules.</span> Sarathy never sells personal data. Benchmarks use anonymised, aggregated data only, and no individual is ever identifiable.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 mb-5">
        <div className="flex bg-white rounded-2xl p-1 shadow-sm">
          {[
            { id: 'profile', label: 'My profile' },
            { id: 'behaviour', label: 'Behaviour' },
            { id: 'benchmark', label: 'Benchmarks' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeTab === t.id ? 'bg-saffron text-white' : 'text-ink-3'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 flex flex-col gap-3">

        {/* MY PROFILE TAB */}
        {activeTab === 'profile' && (
          <>
            <div className="card">
              <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-3">
                What Sarathy knows about you
              </p>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Name', value: profile?.name || '-' },
                  { label: 'User type', value: profile?.user_types?.join(', ') || '-' },
                  { label: 'Home country', value: profile?.home_country || '-' },
                  { label: 'Current country', value: profile?.current_country || 'Singapore' },
                  { label: 'Monthly budget', value: profile?.planning_amount ? formatCurrency(profile.planning_amount, currency) : '-' },
                  { label: 'Money fear', value: profile?.money_fear || '-' },
                  { label: 'Responsible for', value: profile?.responsible_for || '-' },
                  { label: 'Companion vibe', value: profile?.companion_vibe?.replace(/_/g, ' ') || '-' },
                  { label: 'Transactions logged', value: `${entries.length}` },
                  { label: 'Mood logs', value: `${moodLogs.length}` },
                  { label: 'Goals set', value: `${goals.length}` },
                  { label: 'Member since', value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }) : '-' },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-1 border-b border-cream last:border-0">
                    <span className="text-xs text-ink-3">{row.label}</span>
                    <span className="text-xs font-medium text-ink capitalize">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card border-l-4 border-safe">
              <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2">
                Data you have NOT shared
              </p>
              <div className="flex flex-col gap-1">
                {[
                  'Bank account numbers or login credentials',
                  'Government ID or passport details',
                  'Exact location or address',
                  'Contact list or social connections',
                  'Any data sold to third parties',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-safe" />
                    <span className="text-xs text-ink-3">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* BEHAVIOUR TAB */}
        {activeTab === 'behaviour' && (
          <>
            <div className="card">
              <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-3">
                Your financial behaviour profile
              </p>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Top spending category', value: `${behaviour.topCat} (${behaviour.topCatPct}%)` },
                  { label: 'Total transactions logged', value: `${behaviour.totalTransactions}` },
                  { label: 'Average transaction size', value: formatCurrency(behaviour.avgTransaction, currency) },
                  { label: 'Anxious mood days logged', value: `${behaviour.anxiousDays}` },
                  { label: 'Good mood days logged', value: `${behaviour.goodDays}` },
                  { label: 'Emotional spending pattern', value: behaviour.emotionalSpender ? 'Detected' : 'Not detected' },
                  { label: 'Current streak', value: `${behaviour.streak} days` },
                  { label: 'Total XP earned', value: `${behaviour.totalXP}` },
                  { label: 'Goals set', value: `${behaviour.goalsSet}` },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-1 border-b border-cream last:border-0">
                    <span className="text-xs text-ink-3">{row.label}</span>
                    <span className={`text-xs font-medium ${
                      row.label === 'Emotional spending pattern' && row.value === 'Detected'
                        ? 'text-warning'
                        : 'text-ink'
                    }`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card border-l-4 border-saffron">
              <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2">
                Why this matters
              </p>
              <p className="text-sm text-ink leading-relaxed">
                This is the data layer that no bank will ever have. Banks see transactions. Sarathy sees the context around them: when you were anxious, what you resisted buying, and how your mood connects to spending. That self-knowledge is yours.
              </p>
            </div>
          </>
        )}

        {/* BENCHMARKS TAB */}
        {activeTab === 'benchmark' && (
          <>
            <div className="card mb-1">
              <p className="text-xs text-ink-3 leading-relaxed">
                Benchmarks are based on anonymised, aggregated data from Singapore student spending patterns. No individual data is ever shared or compared.
              </p>
            </div>

            {entries.length < 3 ? (
              <div className="card text-center py-8">
                <Sprout className="mx-auto mb-3 h-10 w-10 text-saffron" />
                <p className="font-medium text-ink mb-1">Log more to unlock benchmarks</p>
                <p className="text-ink-3 text-sm">Need at least 3 transactions to generate comparisons.</p>
              </div>
            ) : (
              benchmarks.map(b => {
                const myVal = b.mine
                const avgVal = b.avg
                const myPct = Math.min(100, Math.round((myVal / Math.max(avgVal * 1.5, myVal)) * 100))
                const avgPct = Math.min(100, Math.round((avgVal / Math.max(avgVal * 1.5, myVal)) * 100))
                const better = b.unit !== 'days' ? myVal <= avgVal : myVal >= avgVal

                return (
                  <div key={b.label} className="card">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-ink">{b.label}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        better ? 'bg-green-50 text-safe' : 'bg-saffron-soft text-saffron'
                      }`}>
                        {better ? 'Above average' : 'Below average'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 mb-3">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-ink-3">You</span>
                          <span className="text-xs font-semibold text-ink">
                            {b.unit !== 'days' ? formatCurrency(myVal, currency) : `${myVal} ${b.unit}`}
                          </span>
                        </div>
                        <div className="h-2 bg-cream-3 rounded-full">
                          <div
                            className="h-2 rounded-full bg-saffron"
                            style={{ width: `${myPct}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-ink-3">SG student average</span>
                          <span className="text-xs font-medium text-ink-3">
                            {b.unit !== 'days' ? formatCurrency(avgVal, currency) : `${avgVal} ${b.unit}`}
                          </span>
                        </div>
                        <div className="h-2 bg-cream-3 rounded-full">
                          <div
                            className="h-2 rounded-full bg-ink-3/30"
                            style={{ width: `${avgPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-ink-3 leading-relaxed">{b.insight}</p>
                  </div>
                )
              })
            )}
          </>
        )}

      </div>

      <TabBar active="story" />
    </div>
  )
}
