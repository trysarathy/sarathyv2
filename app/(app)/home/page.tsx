'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  calculateSafeToSpend,
  groupEntriesByCategory,
  formatCurrency,
  getCategoryEmoji,
  getMonthEntries,
} from '@/lib/calculations'
import { attachDreamProgress, finalizeDreamMonths } from '@/lib/dream-goal'
import { Profile, BudgetEntry, FixedSpending, SafeToSpendData, PLCategory } from '@/types'
import { todayInSingapore } from '@/lib/sarathy/sgt'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'
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
import HomeWalkthrough from '@/components/home/HomeWalkthrough'
import { EXPENSE_CATEGORIES } from '@/lib/expense/categories'
import { friendlyExpenseSaveError, friendlyHomeLoadError } from '@/lib/booth/friendly-errors'
import { isHomeWalkthroughDone } from '@/lib/booth/walkthrough-storage'

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [entries, setEntries] = useState<BudgetEntry[]>([])
  const [fixedSpending, setFixedSpending] = useState<FixedSpending[]>([])
  const [safeData, setSafeData] = useState<SafeToSpendData | null>(null)
  const [categories, setCategories] = useState<PLCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [logMode, setLogMode] = useState<'manual' | 'voice' | null>(null)
  const heroAnchorRef = useRef<HTMLDivElement>(null)
  const actionsTourRef = useRef<HTMLDivElement>(null)
  const monthTileRef = useRef<HTMLButtonElement>(null)
  const [showWalkthrough, setShowWalkthrough] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadSlow, setLoadSlow] = useState(false)
  const [showTrust, setShowTrust] = useState(false)
  const [showMonth, setShowMonth] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<PLCategory | null>(null)
  const [editingEntry, setEditingEntry] = useState<BudgetEntry | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [savingEntry, setSavingEntry] = useState(false)
  const [entrySaveError, setEntrySaveError] = useState<string | null>(null)
  const [xpFloat, setXpFloat] = useState<{ show: boolean; x: number; y: number; xp: number }>({
    show: false,
    x: 0,
    y: 0,
    xp: 0,
  })

  const loadData = useCallback(async () => {
    setLoadError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }

    const [profileRes, entriesRes, fixedRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('budget_entries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('fixed_spending').select('*').eq('user_id', user.id).eq('is_active', true),
    ])

    if (entriesRes.error) {
      console.error('Failed to load budget entries:', entriesRes.error.message)
    }

    if (profileRes.error || !profileRes.data) {
      console.error('Failed to load profile:', profileRes.error?.message)
      setLoadError(friendlyHomeLoadError())
      setLoading(false)
      return
    }

    let p = profileRes.data as Profile
    if (!p.onboarding_complete) { router.replace('/onboarding'); return }

    const e = (entriesRes.error ? [] : entriesRes.data || []) as BudgetEntry[]
    const f = (fixedRes.error ? [] : fixedRes.data || []) as FixedSpending[]
    const today = todayInSingapore()

    try {
      const finalized = await finalizeDreamMonths(supabase, user.id, p, e, f, today)
      if (finalized) p = finalized
    } catch (err) {
      console.error('Dream month finalize failed:', err)
    }

    setProfile(p)
    setEntries(e)
    setFixedSpending(f)

    const safe = attachDreamProgress(calculateSafeToSpend(p, e, f), p, today)
    setSafeData(safe)

    const monthEntries = getMonthEntries(e)
    setCategories(groupEntriesByCategory(monthEntries))
    setLoading(false)
  }, [router, supabase])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!loading) {
      setLoadSlow(false)
      return
    }
    const t = window.setTimeout(() => setLoadSlow(true), 15000)
    return () => window.clearTimeout(t)
  }, [loading])

  useEffect(() => {
    if (!loading && profile && safeData && !isHomeWalkthroughDone()) {
      const t = window.setTimeout(() => setShowWalkthrough(true), 400)
      return () => window.clearTimeout(t)
    }
  }, [loading, profile, safeData])

  const handleExpenseLogged = async (xp: number, coords?: { x: number; y: number }) => {
    let x = coords?.x
    let y = coords?.y

    if (x == null || y == null) {
      const hero = heroAnchorRef.current
      if (hero) {
        const rect = hero.getBoundingClientRect()
        x = rect.left + rect.width / 2
        y = rect.top + rect.height * 0.35
      }
    }

    if (x != null && y != null) {
      setXpFloat({ show: true, x, y, xp })
      setTimeout(() => setXpFloat({ show: false, x: 0, y: 0, xp: 0 }), 1200)
    }

    await loadData()
  }

  const openEditEntry = (entry: BudgetEntry) => {
    setEditingEntry(entry)
    setEditAmount(String(entry.amount))
    setEditDescription(entry.description ?? '')
    setEditDate(entry.entry_date.slice(0, 10))
    setEditCategory(entry.category)
    setEntrySaveError(null)
  }

  const closeEditEntry = () => {
    setEditingEntry(null)
    setEntrySaveError(null)
  }

  const handleSaveEntry = async () => {
    if (!editingEntry) return
    const amount = parseFloat(editAmount)
    if (!amount || amount <= 0) {
      setEntrySaveError('Enter a valid amount')
      return
    }
    setSavingEntry(true)
    setEntrySaveError(null)
    const { error } = await supabase
      .from('budget_entries')
      .update({
        amount: Math.round(amount * 100) / 100,
        description: editDescription.trim() || null,
        entry_date: editDate,
        category: editCategory,
      })
      .eq('id', editingEntry.id)

    setSavingEntry(false)
    if (error) {
      setEntrySaveError(friendlyExpenseSaveError(error.message))
      return
    }
    closeEditEntry()
    setSelectedCategory(null)
    await loadData()
  }

  const handleDeleteEntry = async (entryId: string) => {
    setSavingEntry(true)
    setEntrySaveError(null)
    const { error } = await supabase.from('budget_entries').delete().eq('id', entryId)
    setSavingEntry(false)
    if (error) {
      setEntrySaveError(friendlyExpenseSaveError(error.message))
      return
    }
    closeEditEntry()
    setSelectedCategory(null)
    await loadData()
  }

  const today = todayInSingapore()
  const monthKey = today.slice(0, 7)

  const todaySpent = entries
    .filter(e => e.entry_date === today)
    .reduce((sum, e) => sum + e.amount, 0)

  const meterPercent = safeData
    ? Math.min(100, Math.round((todaySpent / Math.max(safeData.safeToSpend, 1)) * 100))
    : 0

  const meterColor = meterPercent < 70 ? '#10B981' : meterPercent < 90 ? '#F59E0B' : '#F43F5E'

  const monthTotal = entries
    .filter(e => e.entry_date.slice(0, 7) === monthKey)
    .reduce((sum, e) => sum + e.amount, 0)

  if (loading) {
    return (
      <div className="min-h-dvh bg-warm-white flex flex-col items-center justify-center px-6 text-center">
        <div className="w-8 h-8 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
        {loadSlow && (
          <p className="text-sm text-indigo-muted mt-4 max-w-xs leading-relaxed">
            Taking longer than usual — check your connection. This screen will appear when ready.
          </p>
        )}
      </div>
    )
  }

  if (loadError || !profile || !safeData) {
    return (
      <div className="booth-error-screen">
        <p className="font-fraunces text-lg text-indigo mb-2">Couldn&apos;t load home</p>
        <p className="text-sm text-indigo-muted max-w-xs leading-relaxed">
          {loadError ?? friendlyHomeLoadError()}
        </p>
        <button type="button" className="booth-error-retry" onClick={() => { setLoading(true); loadData() }}>
          Retry
        </button>
      </div>
    )
  }

  const currency = getProfileDisplayCurrency(profile)
  const firstName = profile.name?.split(' ')[0]

  return (
    <div className="min-h-dvh bg-warm-white pb-24">
      {xpFloat.show && (
        <div className="xp-float" style={{ left: xpFloat.x, top: xpFloat.y }}>
          +{xpFloat.xp} XP ⚡
        </div>
      )}

      <div className="home-header-zone px-5 pt-12 pb-2">
        <div className="home-enter-1">
          <DailyBriefCard firstName={firstName} />

          <SavingsGoalPrompt profile={profile} onUpdated={loadData} />
        </div>

        <div ref={heroAnchorRef} className="home-enter-2">
          <SafeToSpendHero
            profile={profile}
            safeData={safeData}
            todaySpent={todaySpent}
            meterPercent={meterPercent}
            meterColor={meterColor}
            onTap={() => setShowTrust(true)}
          />
        </div>

        <div className="home-enter-3">
          <HomeActionsRow
            tourRef={actionsTourRef}
            onLogExpense={() => setLogMode('manual')}
            onVoiceLog={() => setLogMode('voice')}
          />

          <MoodCheckIn userId={profile.id} variant="inline" />
        </div>
      </div>

      <div className="home-enter-4">
        <div className="px-5">
          <ConnectedAccountsStrip
            profile={profile}
            existingEntries={entries}
            onSynced={loadData}
          />
        </div>

        <ExploreGrid monthTileRef={monthTileRef} onOpenMonth={() => setShowMonth(true)} />
      </div>

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
                <div key={entry.id} className="flex items-center justify-between py-2 border-b border-cream last:border-0 gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{entry.description || entry.category}</p>
                    <p className="text-xs text-ink-3">
                      {new Date(entry.entry_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-ink shrink-0">{formatCurrency(entry.amount, currency)}</span>
                  <button
                    type="button"
                    onClick={() => openEditEntry(entry)}
                    className="text-xs text-ink-3 px-2 py-1 rounded-lg bg-cream shrink-0"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {editingEntry && (
        <>
          <div className="overlay" onClick={closeEditEntry} />
          <div className="bottom-sheet">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-fraunces text-xl font-semibold text-ink">Edit expense</h3>
              <button type="button" onClick={closeEditEntry} className="text-ink-3 text-2xl">×</button>
            </div>

            <input
              type="number"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              placeholder="Amount"
              className="input-field mb-3"
              inputMode="decimal"
            />
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description"
              className="input-field mb-3"
            />
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="input-field mb-3"
            />
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className="input-field mb-3"
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {entrySaveError && (
              <p className="text-xs text-danger mb-3">{entrySaveError}</p>
            )}

            <button
              type="button"
              onClick={handleSaveEntry}
              disabled={savingEntry}
              className="btn-primary"
            >
              {savingEntry ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => handleDeleteEntry(editingEntry.id)}
              disabled={savingEntry}
              className="w-full mt-3 py-3 text-sm text-danger font-medium"
            >
              Delete expense
            </button>
          </div>
        </>
      )}

      {logMode && (
        <LogExpenseSheet
          profile={profile}
          onClose={() => setLogMode(null)}
          onLogged={handleExpenseLogged}
          startInListeningMode={logMode === 'voice'}
        />
      )}

      {showTrust && safeData && (
        <TrustLayerModal
          safeData={safeData}
          onClose={() => setShowTrust(false)}
        />
      )}

      {showWalkthrough && (
        <HomeWalkthrough
          heroRef={heroAnchorRef}
          actionsRef={actionsTourRef}
          monthTileRef={monthTileRef}
          onDone={() => setShowWalkthrough(false)}
        />
      )}

      <TabBar active="home" />
    </div>
  )
}
