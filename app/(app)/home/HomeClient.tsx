'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { todayInSingapore, formatRelativeEntryDate } from '@/lib/sarathy/sgt'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'
import TabBar from '@/components/ui/TabBar'
import MoodCheckIn from '@/components/home/MoodCheckIn'
import LogExpenseSheet from '@/components/home/LogExpenseSheet'
import TrustLayerModal from '@/components/home/TrustLayerModal'
import ConnectedAccountsStrip from '@/components/home/ConnectedAccountsStrip'
import AccountsSummaryLine from '@/components/home/AccountsSummaryLine'
import TodayView from '@/components/home/TodayView'
import ThisMonthCard from '@/components/home/ThisMonthCard'
import RecentExpensesCard from '@/components/home/RecentExpensesCard'
import CreateFirstCircleCard from '@/components/home/CreateFirstCircleCard'
import MonthSummarySheet from '@/components/home/MonthSummarySheet'
import HomeWalkthrough from '@/components/home/HomeWalkthrough'
import ExpenseDatePicker from '@/components/home/ExpenseDatePicker'
import NotificationOptInPrompt from '@/components/notifications/NotificationOptInPrompt'
import { EXPENSE_CATEGORIES } from '@/lib/expense/categories'
import { friendlyExpenseSaveError, friendlyHomeLoadError } from '@/lib/booth/friendly-errors'
import { isHomeWalkthroughDone } from '@/lib/booth/walkthrough-storage'
import { isPushConfigured, subscribeToPush } from '@/lib/notifications/client'

export default function HomeClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const monthCardRef = useRef<HTMLDivElement>(null)
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
  const [showNotifyPrompt, setShowNotifyPrompt] = useState(false)
  const [notifyBusy, setNotifyBusy] = useState(false)
  const [notifyError, setNotifyError] = useState('')
  const [hasCircles, setHasCircles] = useState<boolean | null>(null)
  const deepLinkHandled = useRef(false)
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

    const [profileRes, entriesRes, fixedRes, circlesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('budget_entries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('fixed_spending').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('circle_members').select('circle_id').eq('user_id', user.id).limit(1),
    ])

    setHasCircles(Boolean(circlesRes.data && circlesRes.data.length > 0))

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

  // Deep link from push notification → open Log Expense sheet
  useEffect(() => {
    if (loading || !profile || deepLinkHandled.current) return
    if (searchParams.get('log') === 'expense') {
      deepLinkHandled.current = true
      setLogMode('manual')
      router.replace('/home', { scroll: false })
    }
  }, [loading, profile, searchParams, router])

  // Service worker message fallback when client already open
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SARATHY_OPEN_LOG_EXPENSE') {
        setLogMode('manual')
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  // Fallback: show opt-in on home if they somehow skipped it (prompt_seen still false)
  // Skip entirely when VAPID keys aren't configured — mark prompt seen so it never errors
  useEffect(() => {
    if (loading || !profile || showWalkthrough || showNotifyPrompt) return
    if (profile.notifications_prompt_seen !== false) return

    if (!isPushConfigured()) {
      void supabase
        .from('profiles')
        .update({
          notifications_prompt_seen: true,
          notifications_enabled: false,
        })
        .eq('id', profile.id)
        .then(() => {
          setProfile((prev) =>
            prev
              ? { ...prev, notifications_prompt_seen: true, notifications_enabled: false }
              : prev
          )
        })
      return
    }

    const t = window.setTimeout(() => setShowNotifyPrompt(true), 600)
    return () => window.clearTimeout(t)
  }, [loading, profile, showWalkthrough, showNotifyPrompt, supabase])

  const dismissNotifyPrompt = async (enabled: boolean) => {
    if (!profile) return
    setNotifyBusy(true)
    setNotifyError('')
    try {
      if (enabled) {
        const result = await subscribeToPush()
        if (!result.ok) {
          console.warn('[notifications]', result.error)
          // Keep prompt open + do NOT mark notifications_prompt_seen
          setNotifyError(result.error || 'Something went wrong')
          return
        }
        // API already sets enabled + prompt_seen; also set default time locally
        await supabase
          .from('profiles')
          .update({
            notification_time: profile.notification_time || '20:00:00',
          })
          .eq('id', profile.id)
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                notifications_enabled: true,
                notifications_prompt_seen: true,
              }
            : prev
        )
        setShowNotifyPrompt(false)
      } else {
        // Explicit dismiss only
        await supabase
          .from('profiles')
          .update({
            notifications_enabled: false,
            notifications_prompt_seen: true,
          })
          .eq('id', profile.id)
        setProfile((prev) =>
          prev
            ? { ...prev, notifications_enabled: false, notifications_prompt_seen: true }
            : prev
        )
        setShowNotifyPrompt(false)
      }
    } catch (err) {
      console.error('[notifications] opt-in failed:', err)
      setNotifyError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setNotifyBusy(false)
    }
  }

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

  return (
    <>
      {xpFloat.show && (
        <div className="xp-float" style={{ left: xpFloat.x, top: xpFloat.y }}>
          +{xpFloat.xp} XP ⚡
        </div>
      )}

      <TodayView
        safeToSpend={safeData.safeToSpend}
        currency={currency}
        showSafeToSpend={
          Boolean(profile.planning_amount && profile.planning_amount > 0) &&
          entries.length > 0
        }
        totalBalance={<AccountsSummaryLine profile={profile} />}
        heroRef={heroAnchorRef}
        actionsRef={actionsTourRef}
        monthCardRef={monthCardRef}
        onLogExpense={() => setLogMode('manual')}
        onVoiceLog={() => setLogMode('voice')}
        onAskSarathy={() => router.push('/sarathy')}
        onTapBreakdown={() => setShowTrust(true)}
        onSetupBudget={() => {
          document.getElementById('this-month-card')?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          })
        }}
        moodSlot={<MoodCheckIn userId={profile.id} variant="inline" />}
        accountsSlot={
          <ConnectedAccountsStrip
            profile={profile}
            existingEntries={entries}
            onSynced={loadData}
          />
        }
        afterAccountsSlot={
          hasCircles === false ? (
            <CreateFirstCircleCard onCreate={() => router.push('/circles?create=1')} />
          ) : null
        }
        monthCardSlot={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ThisMonthCard
              profile={profile}
              monthTotal={monthTotal}
              currency={currency}
              onLogFirstExpense={() => setLogMode('manual')}
              onOpenDetails={() => setShowMonth(true)}
              onBudgetUpdated={(planningAmount) => {
                setProfile((prev) => (prev ? { ...prev, planning_amount: planningAmount } : prev))
                void loadData()
              }}
            />
            <RecentExpensesCard
              entries={entries}
              currency={currency}
              onSeeAll={() => setShowMonth(true)}
            />
          </div>
        }
      >
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
            onBudgetUpdated={(planningAmount) => {
              setProfile((prev) => (prev ? { ...prev, planning_amount: planningAmount } : prev))
              void loadData()
            }}
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
                        {formatRelativeEntryDate(entry.entry_date)}
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
              <div className="mb-3">
                <ExpenseDatePicker
                  value={editDate}
                  onChange={setEditDate}
                  max={todayInSingapore()}
                  id="edit-expense-date"
                />
              </div>
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
            monthTileRef={monthCardRef}
            onDone={() => setShowWalkthrough(false)}
          />
        )}

        {showNotifyPrompt && profile && (
          <NotificationOptInPrompt
            vibe={profile.companion_vibe}
            busy={notifyBusy}
            error={notifyError}
            onEnable={() => dismissNotifyPrompt(true)}
            onLater={() => dismissNotifyPrompt(false)}
          />
        )}
      </TodayView>

      <TabBar active="home" />
    </>
  )
}
