'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  AlertTriangle,
  Bell,
  BellRing,
  Brain,
  Bus,
  CalendarClock,
  ChevronRight,
  Clapperboard,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  HeartHandshake,
  Home as HomeIcon,
  Import,
  MessageCircle,
  MoreHorizontal,
  Pill,
  Plus,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Utensils,
  WalletCards,
  X,
  UsersRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import {
  calculateSafeToSpend,
  groupEntriesByCategory,
  formatCurrency,
  getMonthEntries,
} from '@/lib/calculations'
import { Profile, BudgetEntry, FixedSpending, SafeToSpendData, PLCategory, SafetyStatus } from '@/types'
import {
  getFirstName,
  getHomePersonalization,
  getPersonalActionHelpers,
  getSarathyInbox,
} from '@/lib/personalization'
import type { SarathyInboxItem } from '@/lib/personalization'
import TabBar from '@/components/ui/TabBar'
import MoodCheckIn from '@/components/home/MoodCheckIn'
import LogExpenseSheet from '@/components/home/LogExpenseSheet'
import TrustLayerModal from '@/components/home/TrustLayerModal'

const categoryIcons: Record<string, LucideIcon> = {
  Food: Utensils,
  Transport: Bus,
  Social: UsersRound,
  Home: HomeIcon,
  Family: HeartHandshake,
  Shopping: ShoppingBag,
  Health: Pill,
  Education: GraduationCap,
  Entertainment: Clapperboard,
  Other: MoreHorizontal,
}

const statusTone: Record<SafetyStatus, { text: string; bg: string; border: string; accent: string; label: string }> = {
  safe: {
    text: 'text-safe',
    bg: 'bg-mint',
    border: 'border-safe/25',
    accent: '#10B981',
    label: 'On track',
  },
  tight: {
    text: 'text-warning',
    bg: 'bg-amber-50',
    border: 'border-warning/25',
    accent: '#F59E0B',
    label: 'Tight',
  },
  danger: {
    text: 'text-danger',
    bg: 'bg-rose-50',
    border: 'border-danger/25',
    accent: '#F43F5E',
    label: 'At risk',
  },
}

type PersonalActionKey = keyof ReturnType<typeof getPersonalActionHelpers>

const primaryActions: Array<{ key: PersonalActionKey; href: string; label: string; icon: LucideIcon }> = [
  { key: 'check', href: '/check', label: 'Money check', icon: Target },
  { key: 'future', href: '/future', label: 'Future you', icon: CalendarClock },
  { key: 'upload', href: '/upload', label: 'Import transactions', icon: Import },
]

const secondaryActions: Array<{ key: PersonalActionKey; href: string; label: string; icon: LucideIcon }> = [
  { key: 'biases', href: '/biases', label: 'Money psychology', icon: Brain },
  { key: 'insights', href: '/insights', label: 'Financial DNA', icon: Sparkles },
  { key: 'mydata', href: '/mydata', label: 'My data', icon: BarChart3 },
  { key: 'remittance', href: '/remittance', label: 'Send money home', icon: Send },
  { key: 'marketplace', href: '/marketplace', label: 'Built for you', icon: WalletCards },
  { key: 'fixed', href: '/fixed', label: 'Fixed costs', icon: FileText },
]

function CategoryIcon({ category }: { category: string }) {
  const Icon = categoryIcons[category] || MoreHorizontal
  return <Icon className="h-4 w-4" />
}

const inboxIcons: Record<SarathyInboxItem['icon'], LucideIcon> = {
  alert: AlertTriangle,
  check: CheckCircle2,
  clock: Clock3,
  home: HomeIcon,
  message: MessageCircle,
  sparkles: Sparkles,
  target: Target,
  wallet: WalletCards,
}

const inboxTones: Record<SarathyInboxItem['tone'], { icon: string; dot: string; bg: string; border: string }> = {
  danger: { icon: 'text-danger', dot: 'bg-danger', bg: 'bg-rose-50', border: 'border-danger/20' },
  warning: { icon: 'text-warning', dot: 'bg-warning', bg: 'bg-amber-50', border: 'border-warning/20' },
  safe: { icon: 'text-safe', dot: 'bg-safe', bg: 'bg-green-50', border: 'border-safe/20' },
  plum: { icon: 'text-plum', dot: 'bg-plum', bg: 'bg-cream', border: 'border-plum/10' },
  saffron: { icon: 'text-saffron', dot: 'bg-saffron', bg: 'bg-saffron-soft', border: 'border-saffron/20' },
}

function InboxRow({
  item,
  onAction,
  onNavigate,
  compact = false,
}: {
  item: SarathyInboxItem
  onAction: (item: SarathyInboxItem) => void
  onNavigate?: () => void
  compact?: boolean
}) {
  const Icon = inboxIcons[item.icon]
  const tone = inboxTones[item.tone]
  const content = (
    <>
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border ${tone.border} ${tone.bg} ${tone.icon}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
          <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
        </div>
        <p className={`${compact ? 'line-clamp-1' : ''} text-xs leading-relaxed text-ink-3`}>{item.body}</p>
        {!compact && <p className="mt-2 text-xs font-semibold text-saffron">{item.actionLabel}</p>}
      </div>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-ink-3" />
    </>
  )
  const className = `flex w-full items-center gap-3 rounded-2xl border border-line bg-white px-4 ${compact ? 'py-3' : 'py-4'} text-left transition-colors hover:bg-cream/70`

  if (item.href) {
    return (
      <Link href={item.href} onClick={onNavigate} className={className}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={() => onAction(item)} className={className}>
      {content}
    </button>
  )
}

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
  const [showInbox, setShowInbox] = useState(false)
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

  const handleExpenseLogged = async (_xp: number, eventX: number, eventY: number) => {
    setXpFloat({ show: true, x: eventX, y: eventY })
    setTimeout(() => setXpFloat({ show: false, x: 0, y: 0 }), 1200)
    await loadData()
  }

  const todaySpent = entries
    .filter(e => e.entry_date === new Date().toISOString().split('T')[0])
    .reduce((sum, e) => sum + e.amount, 0)

  const monthTotal = entries
    .filter(e => {
      const d = new Date(e.entry_date)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, e) => sum + e.amount, 0)

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white">
        <div className="h-8 w-8 rounded-full border-2 border-saffron border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!profile || !safeData) return null

  const currency = profile.primary_currency || 'SGD'
  const tone = statusTone[safeData.status]
  const firstName = getFirstName(profile)
  const meterPercent = safeData.safeToSpend <= 0
    ? todaySpent > 0 ? 100 : 0
    : Math.min(100, Math.round((todaySpent / safeData.safeToSpend) * 100))
  const monthBalance = (profile.planning_amount || 0) - monthTotal
  const monthlyRows = categories.slice(0, 4)
  const personalNote = getHomePersonalization(profile, safeData, categories[0])
  const actionHelpers = getPersonalActionHelpers(profile, safeData, categories[0])
  const inbox = getSarathyInbox(profile, safeData, entries, fixedSpending, categories)
  const inboxPreview = inbox.items.slice(0, 2)

  const handleInboxAction = (item: SarathyInboxItem) => {
    setShowInbox(false)
    if (item.action === 'log-expense') setShowLog(true)
    if (item.action === 'open-safety') setShowTrust(true)
  }

  return (
    <div className="min-h-dvh bg-white">
      <main className="mx-auto min-h-dvh max-w-[480px] bg-white pb-36">
        {xpFloat.show && (
          <div className="xp-float" style={{ left: xpFloat.x, top: xpFloat.y }}>
            +10 XP
          </div>
        )}

        <header className="px-5 pt-10">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="font-fraunces text-4xl font-semibold text-plum">Sarathy</p>
              <p className="mt-3 text-xl font-semibold text-plum">Good morning, {firstName}</p>
              <p className="mt-1 text-sm text-ink-3">{safeData.safetyLine}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowInbox(true)}
              className="relative mt-2 flex h-11 w-11 items-center justify-center rounded-xl border border-line text-plum"
              aria-label={`Open Sarathy inbox with ${inbox.items.length} notes`}
            >
              <Bell className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-saffron px-1 text-[10px] font-bold text-white shadow-sm">
                {inbox.items.length}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowTrust(true)}
            className={`w-full rounded-2xl border ${tone.border} bg-white p-5 text-left shadow-[0_12px_40px_rgba(30,10,46,0.06)] transition-transform active:scale-[0.99]`}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone.bg} ${tone.text}`}>
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-ink">Safe to spend today</p>
                  <p className="text-xs font-medium text-ink-3">{tone.label}</p>
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-saffron-soft text-saffron">
                <WalletCards className="h-5 w-5" />
              </div>
            </div>
            <p className={`safe-number ${tone.text}`}>
              {formatCurrency(safeData.safeToSpend, currency)}
            </p>
            <div className={`mt-5 flex items-center gap-2 ${tone.text}`}>
              <ShieldCheck className="h-4 w-4" />
              <p className="text-sm font-semibold">{safeData.safetyLine}</p>
            </div>
          </button>
        </header>

        <section className="px-5 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <BellRing className="h-4 w-4 text-saffron" />
                <h2 className="text-sm font-bold text-plum">{inbox.title}</h2>
              </div>
              <p className="mt-1 text-xs text-ink-3">{inbox.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowInbox(true)}
              className="flex-shrink-0 text-xs font-semibold text-saffron"
            >
              View all
            </button>
          </div>
          <div className="grid gap-2">
            {inboxPreview.map(item => (
              <InboxRow
                key={item.id}
                item={item}
                onAction={handleInboxAction}
                onNavigate={() => setShowInbox(false)}
                compact
              />
            ))}
          </div>
        </section>

        <section className="px-5 pt-4">
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-plum">Today's spending</p>
                <p className="mt-1 text-2xl font-semibold text-plum">
                  {formatCurrency(todaySpent, currency)}
                  <span className="ml-1 text-base font-medium text-ink-3">
                    of {formatCurrency(safeData.safeToSpend, currency)}
                  </span>
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-ink-3">
                <BarChart3 className="h-5 w-5" />
              </div>
            </div>
            <div className="meter-bar">
              <div
                className="meter-fill"
                style={{ width: `${meterPercent}%`, background: tone.accent }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowLog(true)}
            className="btn-primary mt-3 shadow-[0_12px_30px_rgba(249,115,22,0.24)]"
          >
            <Plus className="h-5 w-5" />
            Log expense
          </button>
        </section>

        <section className="px-5 pt-4">
          <div className="rounded-2xl border border-plum/10 bg-plum px-4 py-4 text-white shadow-[0_12px_34px_rgba(30,10,46,0.12)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{personalNote.eyebrow}</p>
              <Sparkles className="h-4 w-4 text-white/70" />
            </div>
            <p className="text-lg font-semibold">{personalNote.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-white/80">{personalNote.body}</p>
            <p className="mt-3 border-t border-white/15 pt-3 text-xs leading-relaxed text-white/65">{personalNote.detail}</p>
          </div>
        </section>

        <section className="px-5 pt-4">
          <div className="card overflow-hidden p-0">
            <div className="border-b border-line px-4 py-4">
              <p className="text-lg font-semibold text-plum">This month</p>
            </div>

            {!!profile.planning_amount && (
              <div className="flex items-center justify-between gap-3 border-b border-cream px-4 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-mint text-safe">
                    <WalletCards className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">Income / Budget</p>
                    <p className="text-xs text-ink-3">Available plan</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-safe">+{formatCurrency(profile.planning_amount, currency)}</p>
              </div>
            )}

            {monthlyRows.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-semibold text-ink">No expenses this month yet</p>
                <p className="mt-1 text-xs text-ink-3">Log your first one to build the monthly picture.</p>
              </div>
            ) : (
              monthlyRows.map(cat => (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className="flex w-full items-center justify-between gap-3 border-b border-cream px-4 py-4 text-left transition-colors last:border-0 hover:bg-cream/70"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-saffron-soft text-saffron">
                      <CategoryIcon category={cat.category} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{cat.category}</p>
                      <p className="text-xs text-ink-3">{cat.percentage}% of spending</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{formatCurrency(cat.total, currency)}</span>
                    <ChevronRight className="h-4 w-4 text-ink-3" />
                  </div>
                </button>
              ))
            )}

            {!!profile.planning_amount && (
              <div className="flex items-center justify-between bg-cream/70 px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint text-safe">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold text-ink">Balance</span>
                </div>
                <span className={`text-base font-bold ${monthBalance >= 0 ? 'text-safe' : 'text-danger'}`}>
                  {formatCurrency(monthBalance, currency)}
                </span>
              </div>
            )}
          </div>
        </section>

        {selectedCategory && (
          <>
            <div className="overlay" onClick={() => setSelectedCategory(null)} />
            <div className="bottom-sheet">
              <div className="sheet-handle" />
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-saffron-soft text-saffron">
                    <CategoryIcon category={selectedCategory.category} />
                  </div>
                  <div>
                    <h3 className="font-fraunces text-xl font-semibold text-ink">{selectedCategory.category}</h3>
                    <p className="text-xs text-ink-3">{formatCurrency(selectedCategory.total, currency)} total</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-3"
                  aria-label="Close category details"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex max-h-72 flex-col overflow-y-auto">
                {selectedCategory.entries.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 border-b border-cream py-3 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{entry.description || entry.category}</p>
                      <p className="text-xs text-ink-3">{new Date(entry.entry_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}</p>
                    </div>
                    <span className="text-sm font-semibold text-ink">{formatCurrency(entry.amount, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {showInbox && (
          <>
            <div className="overlay" onClick={() => setShowInbox(false)} />
            <div className="bottom-sheet max-h-[82dvh] overflow-y-auto">
              <div className="sheet-handle" />
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-fraunces text-xl font-semibold text-ink">{inbox.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-3">{inbox.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInbox(false)}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-line text-ink-3"
                  aria-label="Close Sarathy inbox"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="grid gap-2">
                {inbox.items.map(item => (
                  <InboxRow
                    key={item.id}
                    item={item}
                    onAction={handleInboxAction}
                    onNavigate={() => setShowInbox(false)}
                  />
                ))}
              </div>
              <div className="mt-4 rounded-2xl bg-cream px-4 py-3">
                <p className="text-xs leading-relaxed text-ink-3">
                  Sarathy does not need to interrupt you to be useful. The inbox refreshes when you open the app and stays quiet otherwise.
                </p>
              </div>
            </div>
          </>
        )}

        <section className="px-5 pt-4">
          <MoodCheckIn userId={profile.id} />
        </section>

        <section className="px-5 pt-4">
          <div className="grid grid-cols-3 gap-3">
            {primaryActions.map(action => {
              const Icon = action.icon

              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex min-h-[104px] flex-col justify-between rounded-2xl border border-line bg-white p-3 shadow-[0_8px_24px_rgba(30,10,46,0.04)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Icon className="h-5 w-5 text-plum" />
                    <ChevronRight className="h-4 w-4 text-ink-3" />
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-snug text-ink">{action.label}</p>
                    <p className="mt-1 text-[11px] leading-snug text-ink-3">{actionHelpers[action.key]}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="px-5 pt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-plum">More money tools</h2>
            <p className="text-xs text-ink-3">{secondaryActions.length} tools</p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {secondaryActions.map(action => {
              const Icon = action.icon

              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-cream text-plum">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{action.label}</p>
                      <p className="truncate text-xs text-ink-3">{actionHelpers[action.key]}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-ink-3" />
                </Link>
              )
            })}
          </div>
        </section>

        {showLog && (
          <LogExpenseSheet
            profile={profile}
            onClose={() => setShowLog(false)}
            onLogged={handleExpenseLogged}
          />
        )}

        {showTrust && (
          <TrustLayerModal
            safeData={safeData}
            onClose={() => setShowTrust(false)}
          />
        )}
      </main>

      <TabBar active="home" />
    </div>
  )
}
