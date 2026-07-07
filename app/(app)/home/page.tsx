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
import DailyBriefCard from '@/components/home/DailyBriefCard'
import SavingsGoalPrompt from '@/components/home/SavingsGoalPrompt'
import SafeToSpendHero from '@/components/home/SafeToSpendHero'
import HomeActionsRow from '@/components/home/HomeActionsRow'
import ConnectedAccountsStrip from '@/components/home/ConnectedAccountsStrip'
import ExploreGrid from '@/components/home/ExploreGrid'
import MonthSummarySheet from '@/components/home/MonthSummarySheet'

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
  const [showMonth, setShowMonth] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<PLCategory | null>(null)
  const [xpFloat, setXpFloat] = useState<{ show: boolean; x: number; y: number; xp: number }>({
    show: false,
    x: 0,
    y: 0,
    xp: 0,
  })
  const [showBriefGreeting, setShowBriefGreeting] = useState(false)

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
    setXpFloat({ show: true, x: eventX, y: eventY, xp })
    setTimeout(() => setXpFloat({ show: false, x: 0, y: 0, xp: 0 }), 1200)
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
      {xpFloat.show && (
        <div className="xp-float" style={{ left: xpFloat.x, top: xpFloat.y }}>
          +{xpFloat.xp} XP ⚡
        </div>
      )}

      <div className="px-5 pt-12 pb-2">
        <DailyBriefCard
          key={`brief-${profile.monthly_savings_goal ?? 0}`}
          onBriefLoaded={setShowBriefGreeting}
        />

        <SavingsGoalPrompt profile={profile} onUpdated={loadData} />

        {!showBriefGreeting && (
          <p className="text-ink-3 text-sm mb-3">Hey {profile.name?.split(' ')[0]} 👋</p>
        )}

        <SafeToSpendHero
          profile={profile}
          safeData={safeData}
          todaySpent={todaySpent}
          meterPercent={meterPercent}
          meterColor={meterColor}
          onTap={() => setShowTrust(true)}
        />

        <HomeActionsRow onLogExpense={() => setShowLog(true)} />

        <MoodCheckIn userId={profile.id} variant="inline" />
      </div>

      <div className="px-5">
        <ConnectedAccountsStrip
          profile={profile}
          existingEntries={entries}
          onSynced={loadData}
        />
      </div>

      <ExploreGrid onOpenMonth={() => setShowMonth(true)} />

      {showMonth && (
        <MonthSummarySheet
          profile={profile}
          categories={categories}
          monthTotal={monthTotal}
          currency={currency}
          onSelectCategory={(cat) => {
            setShowMonth(false)
            setSelectedCategory(cat)
          }}
          onClose={() => setShowMonth(false)}
        />
      )}

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
              <button type="button" onClick={() => setSelectedCategory(null)} className="text-ink-3 text-2xl">×</button>
            </div>
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {selectedCategory.entries.map(entry => (
                <div key={entry.id} className="flex items-center justify-between py-2 border-b border-cream last:border-0">
                  <div>
                    <p className="text-sm font-medium text-ink">{entry.description || entry.category}</p>
                    <p className="text-xs text-ink-3">
                      {new Date(entry.entry_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-ink">{formatCurrency(entry.amount, currency)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

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
