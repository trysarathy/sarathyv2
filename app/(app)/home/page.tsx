'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  calculateSafeToSpend,
  groupEntriesByCategory,
  formatCurrency,
  getCategoryEmoji,
  getMonthEntries,
} from '@/lib/calculations'
import { Profile, BudgetEntry, FixedSpending, SafeToSpendData, PLCategory } from '@/types'
import TabBar from '@/components/ui/TabBar'
import MoodCheckIn from '@/components/home/MoodCheckIn'
import LogExpenseSheet from '@/components/home/LogExpenseSheet'
import TrustLayerModal from '@/components/home/TrustLayerModal'
import WiseCard from '@/components/home/WiseCard'

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [entries, setEntries] = useState<BudgetEntry[]>([])
  const [fixedSpending, setFixedSpending] = useState<FixedSpending[]>([])
  const [safeData, setSafeData] = useState<SafeToSpendData | null>(null)
  const [categories, setCategories] = useState<PLCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [showLog, setShowLog] = useState(false)
  const [showTrust, setShowTrust] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<PLCategory | null>(null)
  const [xpFloat, setXpFloat] = useState<{ show: boolean; x: number; y: number }>({ show: false, x: 0, y: 0 })

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }

    const [profileRes, entriesRes, fixedRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('budget_entries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('fixed_spending').select('*').eq('user_id', user.id).eq('is_active', true),
    ])

    if (profileRes.data) {
      const p = profileRes.data as Profile
      if (!p.onboarding_complete) { router.replace('/onboarding'); return }
      setProfile(p)

      const e = (entriesRes.data || []) as BudgetEntry[]
      const f = (fixedRes.data || []) as FixedSpending[]
      setEntries(e)
      setFixedSpending(f)

      const safe = calculateSafeToSpend(p, e, f)
      setSafeData(safe)

      const monthEntries = getMonthEntries(e)
      setCategories(groupEntriesByCategory(monthEntries))
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleExpenseLogged = async (xp: number, eventX: number, eventY: number) => {
    setXpFloat({ show: true, x: eventX, y: eventY })
    setTimeout(() => setXpFloat({ show: false, x: 0, y: 0 }), 1200)
    await loadData()
  }

  const todaySpent = entries
    .filter(e => e.entry_date === new Date().toISOString().split('T')[0])
    .reduce((sum, e) => sum + e.amount, 0)

  const meterPercent = safeData
    ? Math.min(100, Math.round((todaySpent / Math.max(safeData.safeToSpend, 1)) * 100))
    : 0

  const meterColor = meterPercent < 70 ? '#10B981' : meterPercent < 90 ? '#F59E0B' : '#F43F5E'

  const monthTotal = entries
    .filter(e => {
      const d = new Date(e.entry_date)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, e) => sum + e.amount, 0)

  if (loading) {
    return (
      <div className="min-h-dvh bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile || !safeData) return null

  const currency = profile.primary_currency || 'SGD'

  return (
    <div className="min-h-dvh bg-cream pb-24">

      {/* XP Float */}
      {xpFloat.show && (
        <div className="xp-float" style={{ left: xpFloat.x, top: xpFloat.y }}>
          +10 XP ⚡
        </div>
      )}

      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-ink-3 text-sm">Hey {profile.name?.split(' ')[0]} 👋</p>
          <div className="flex items-center gap-1.5 text-xs text-ink-3">
            <span>🔥</span>
            <span className="font-medium">{profile.daily_login_streak}d</span>
            <span className="ml-2">⚡ {profile.total_xp} XP</span>
          </div>
        </div>

        {/* Safety line */}
        <p className={`font-fraunces text-lg font-medium mb-5 ${
          safeData.status === 'safe' ? 'text-safe' :
          safeData.status === 'tight' ? 'text-warning' : 'text-danger'
        }`}>
          {safeData.safetyLine}
        </p>

        {/* Safe-to-spend hero */}
        <button
          onClick={() => setShowTrust(true)}
          className="w-full bg-white rounded-2xl p-5 shadow-sm text-left active:scale-[0.98] transition-transform"
        >
          <p className="text-ink-3 text-xs font-medium uppercase tracking-wide mb-1">
            Safe to spend today
          </p>
          <p className={`safe-number ${
            safeData.status === 'safe' ? 'text-safe' :
            safeData.status === 'tight' ? 'text-warning' : 'text-danger'
          }`}>
            {formatCurrency(safeData.safeToSpend, currency)}
          </p>
          <p className="text-ink-3 text-xs mt-2">Tap to see how I calculated this →</p>
        </button>

        {/* Spending meter */}
        <div className="bg-white rounded-2xl p-4 mt-3 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-medium text-ink-3">Today's spending</p>
            <p className="text-xs font-medium text-ink">
              {formatCurrency(todaySpent, currency)} of {formatCurrency(safeData.safeToSpend, currency)}
            </p>
          </div>
          <div className="meter-bar">
            <div
              className="meter-fill"
              style={{ width: `${meterPercent}%`, background: meterColor }}
            />
          </div>
          <p className={`text-xs mt-2 font-medium ${
            meterPercent < 70 ? 'text-safe' :
            meterPercent < 90 ? 'text-warning' : 'text-danger'
          }`}>
            {meterPercent < 70 ? 'On track 🟢' :
             meterPercent < 90 ? 'A little over 🟡' : 'Over budget today 🔴'}
          </p>
        </div>
      </div>

      {/* P&L Table */}
      <div className="px-5 mb-4">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-cream-3">
            <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide">This month</p>
          </div>

          {profile.planning_amount && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-cream">
              <div className="flex items-center gap-2">
                <span className="text-base">💰</span>
                <span className="text-sm font-medium text-ink">Income / Budget</span>
              </div>
              <span className="text-sm font-semibold text-safe">
                +{formatCurrency(profile.planning_amount, currency)}
              </span>
            </div>
          )}

          {categories.length === 0 ? (
            <div className="px-4 py-6 text-center text-ink-3 text-sm">
              No expenses yet this month — log your first one below 👇
            </div>
          ) : (
            categories.map(cat => (
              <button
                key={cat.category}
                onClick={() => setSelectedCategory(cat)}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-cream last:border-0 active:bg-cream transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{getCategoryEmoji(cat.category)}</span>
                  <div>
                    <span className="text-sm font-medium text-ink">{cat.category}</span>
                    <span className="text-xs text-ink-3 ml-2">{cat.percentage}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">
                    {formatCurrency(cat.total, currency)}
                  </span>
                  <span className="text-ink-3 text-xs">→</span>
                </div>
              </button>
            ))
          )}

          {profile.planning_amount && (
            <div className="flex items-center justify-between px-4 py-3 bg-cream border-t border-cream-3">
              <span className="text-sm font-semibold text-ink">Balance</span>
              <span className={`text-sm font-bold ${
                (profile.planning_amount - monthTotal) >= 0 ? 'text-safe' : 'text-danger'
              }`}>
                {formatCurrency(profile.planning_amount - monthTotal, currency)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Category Drill-down Modal */}
      {selectedCategory && (
        <>
          <div className="overlay" onClick={() => setSelectedCategory(null)} />
          <div className="bottom-sheet">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getCategoryEmoji(selectedCategory.category)}</span>
                <div>
                  <h3 className="font-fraunces text-lg font-semibold text-ink">{selectedCategory.category}</h3>
                  <p className="text-ink-3 text-xs">{formatCurrency(selectedCategory.total, currency)} total</p>
                </div>
              </div>
              <button onClick={() => setSelectedCategory(null)} className="text-ink-3 text-2xl">×</button>
            </div>
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {selectedCategory.entries.map(entry => (
                <div key={entry.id} className="flex items-center justify-between py-2 border-b border-cream last:border-0">
                  <div>
                    <p className="text-sm font-medium text-ink">{entry.description || entry.category}</p>
                    <p className="text-xs text-ink-3">{new Date(entry.entry_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}</p>
                  </div>
                  <span className="text-sm font-semibold text-ink">{formatCurrency(entry.amount, currency)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Mood check-in */}
      <div className="px-5 mb-4">
        <MoodCheckIn userId={profile.id} />
      </div>

      {/* Wise integration */}
      <div className="px-5 mb-4">
        <WiseCard
          profile={profile}
          existingEntries={entries}
          onSynced={loadData}
        />
      </div>

      {/* Quick links — all features */}
      <div className="px-5 mb-4 flex flex-col gap-3">

        <a href="/check" className="card flex items-center justify-between active:opacity-70">
          <div className="flex items-center gap-3">
            <span className="text-xl">🤔</span>
            <div>
              <p className="font-medium text-ink text-sm">Money check</p>
              <p className="text-ink-3 text-xs">Can I afford this? · Impulse · What if</p>
            </div>
          </div>
          <span className="text-ink-3">→</span>
        </a>

        <a href="/biases" className="card flex items-center justify-between active:opacity-70">
          <div className="flex items-center gap-3">
            <span className="text-xl">🧠</span>
            <div>
              <p className="font-medium text-ink text-sm">My money psychology</p>
              <p className="text-ink-3 text-xs">Emotional spending · Present bias · Avoidance</p>
            </div>
          </div>
          <span className="text-ink-3">→</span>
        </a>

        <a href="/future" className="card flex items-center justify-between active:opacity-70">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔮</span>
            <div>
              <p className="font-medium text-ink text-sm">Future you</p>
              <p className="text-ink-3 text-xs">3 scenarios · 6 months from now</p>
            </div>
          </div>
          <span className="text-ink-3">→</span>
        </a>

        <a href="/insights" className="card flex items-center justify-between active:opacity-70">
          <div className="flex items-center gap-3">
            <span className="text-xl">🧬</span>
            <div>
              <p className="font-medium text-ink text-sm">My financial DNA</p>
              <p className="text-ink-3 text-xs">What your data says about you</p>
            </div>
          </div>
          <span className="text-ink-3">→</span>
        </a>

        <a href="/mydata" className="card flex items-center justify-between active:opacity-70">
          <div className="flex items-center gap-3">
            <span className="text-xl">📊</span>
            <div>
              <p className="font-medium text-ink text-sm">My data</p>
              <p className="text-ink-3 text-xs">Your profile · Behaviour · Benchmarks</p>
            </div>
          </div>
          <span className="text-ink-3">→</span>
        </a>

        <a href="/remittance" className="card flex items-center justify-between active:opacity-70">
          <div className="flex items-center gap-3">
            <span className="text-xl">💸</span>
            <div>
              <p className="font-medium text-ink text-sm">Send money home</p>
              <p className="text-ink-3 text-xs">SGD → INR · Live rate · Best provider</p>
            </div>
          </div>
          <span className="text-ink-3">→</span>
        </a>

        <a href="/marketplace" className="card flex items-center justify-between active:opacity-70">
          <div className="flex items-center gap-3">
            <span className="text-xl">🏪</span>
            <div>
              <p className="font-medium text-ink text-sm">Built for you</p>
              <p className="text-ink-3 text-xs">Wise · StashAway · Student accounts</p>
            </div>
          </div>
          <span className="text-ink-3">→</span>
        </a>

        <a href="/upload" className="card flex items-center justify-between active:opacity-70">
          <div className="flex items-center gap-3">
            <span className="text-xl">📄</span>
            <div>
              <p className="font-medium text-ink text-sm">Import transactions</p>
              <p className="text-ink-3 text-xs">Bank statement · receipt scan</p>
            </div>
          </div>
          <span className="text-ink-3">→</span>
        </a>

        <a href="/fixed" className="card flex items-center justify-between active:opacity-70">
          <div className="flex items-center gap-3">
            <span className="text-xl">💳</span>
            <div>
              <p className="font-medium text-ink text-sm">Fixed costs</p>
              <p className="text-ink-3 text-xs">Rent, subscriptions, bills</p>
            </div>
          </div>
          <span className="text-ink-3">→</span>
        </a>

      </div>

      {/* Log Expense Button */}
      <div className="fixed bottom-20 left-0 right-0 px-5 z-40">
        <button
          onClick={() => setShowLog(true)}
          className="btn-primary shadow-lg"
          style={{ boxShadow: '0 4px 20px rgba(249,115,22,0.4)' }}
        >
          + Log expense
        </button>
      </div>

      {showLog && (
        <LogExpenseSheet
          profile={profile}
          onClose={() => setShowLog(false)}
          onLogged={handleExpenseLogged}
        />
      )}

      {showTrust && safeData && (
        <TrustLayerModal
          safeData={safeData}
          onClose={() => setShowTrust(false)}
        />
      )}

      <TabBar active="home" />
    </div>
  )
}
