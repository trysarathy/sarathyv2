import { BudgetEntry, FixedSpending, Profile, SafeToSpendData, SafetyStatus, PLCategory } from '@/types'
import { todayInSingapore } from '@/lib/sarathy/sgt'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'

export interface SafeToSpendAsOf {
  /** Calendar year (same semantics as Date#getFullYear). */
  year: number
  /** 0-indexed month (same semantics as Date#getMonth). */
  month: number
  /** Day of month (same semantics as Date#getDate). */
  day: number
}

function asOfDateString(asOf: SafeToSpendAsOf): string {
  const mm = String(asOf.month + 1).padStart(2, '0')
  const dd = String(asOf.day).padStart(2, '0')
  return `${asOf.year}-${mm}-${dd}`
}

/** Core safe-to-spend calculation for an explicit calendar day (local date parts). */
export function calculateSafeToSpendAsOf(
  profile: Profile,
  entries: BudgetEntry[],
  fixedSpending: FixedSpending[],
  asOf: SafeToSpendAsOf
): SafeToSpendData {
  const { year, month, day: today } = asOf
  const asOfDate = asOfDateString(asOf)
  const monthKey = asOfDate.slice(0, 7)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysLeft = daysInMonth - today + 1
  const currency = getProfileDisplayCurrency(profile)
  const planAmount = profile.planning_amount || 0
  const savingsGoal = profile.monthly_savings_goal ?? 0

  const fixedLeft = fixedSpending
    .filter(f => f.is_active && (f.due_day || 1) >= today)
    .reduce((sum, f) => sum + f.amount, 0)

  // Month totals — used for monthly progress / trust breakdown, not today's safe number
  const currentMonthEntries = entries.filter(e => e.entry_date.slice(0, 7) === monthKey)
  const alreadySpent = currentMonthEntries.reduce((sum, e) => sum + e.amount, 0)

  // Today-only spend drives the hero safe-to-spend
  const spentToday = entries
    .filter(e => e.entry_date === asOfDate)
    .reduce((sum, e) => sum + e.amount, 0)

  const buffer = planAmount * 0.10

  const roomAfterEssentials = planAmount - fixedLeft - alreadySpent - buffer
  const freeToUse = roomAfterEssentials - savingsGoal

  // Daily budget = monthly plan ÷ days remaining; safe today = that minus today's spend only
  const dailyBudget = planAmount / Math.max(daysLeft, 1)
  const safeToSpend = Math.max(0, Math.round(dailyBudget - spentToday))

  let savingsStatus: SafeToSpendData['savings']['status'] = 'none'
  let stillPossible: number | null = null
  if (savingsGoal > 0) {
    if (roomAfterEssentials >= savingsGoal) {
      savingsStatus = 'protected'
    } else {
      savingsStatus = 'at_risk'
      stillPossible = Math.max(0, Math.round(roomAfterEssentials))
    }
  }

  const dailyIdeal = planAmount / daysInMonth
  let status: SafetyStatus = 'safe'
  if (safeToSpend <= 0) status = 'danger'
  else if (safeToSpend < dailyIdeal * 0.5) status = 'tight'

  let safetyLine = ''
  if (status === 'safe') {
    safetyLine = `You're safe till the ${daysInMonth}th 🟢`
  } else if (status === 'tight') {
    safetyLine = `A bit tight — watch spending till the ${daysInMonth}th 🟡`
  } else {
    safetyLine = `At risk this week — let's fix it 🔴`
  }

  return {
    safeToSpend,
    status,
    safetyLine,
    planAmount,
    fixedLeft,
    alreadySpent,
    spentToday,
    dailyBudget: Math.round(dailyBudget),
    buffer,
    freeToUse: Math.max(0, freeToUse),
    daysLeft,
    currency,
    savings: {
      monthlyGoal: savingsGoal,
      goalName: profile.goal_name?.trim() || null,
      status: savingsStatus,
      stillPossible,
      dream: null,
    },
  }
}

export function calculateSafeToSpend(
  profile: Profile,
  entries: BudgetEntry[],
  fixedSpending: FixedSpending[]
): SafeToSpendData {
  const today = todayInSingapore()
  const [year, month, day] = today.split('-').map(Number)
  return calculateSafeToSpendAsOf(profile, entries, fixedSpending, {
    year,
    month: month - 1,
    day,
  })
}

export function groupEntriesByCategory(entries: BudgetEntry[]): PLCategory[] {
  const groups: Record<string, BudgetEntry[]> = {}
  entries.forEach(entry => {
    if (!groups[entry.category]) groups[entry.category] = []
    groups[entry.category].push(entry)
  })

  const total = entries.reduce((sum, e) => sum + e.amount, 0)

  return Object.entries(groups)
    .map(([category, catEntries]) => ({
      category,
      total: catEntries.reduce((sum, e) => sum + e.amount, 0),
      entries: catEntries.sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()),
      percentage: total > 0 ? Math.round((catEntries.reduce((sum, e) => sum + e.amount, 0) / total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

export function formatCurrency(amount: number, currency: string = 'SGD'): string {
  const n = Number.isFinite(amount) ? amount : 0
  if (currency === 'SGD') return `S$${n.toFixed(0)}`
  if (currency === 'INR') return `₹${n.toFixed(0)}`
  if (currency === 'USD') return `$${n.toFixed(0)}`
  if (currency === 'GBP') return `£${n.toFixed(0)}`
  if (currency === 'BRL') return `R$${n.toFixed(0)}`
  if (currency === 'CNY') return `¥${n.toFixed(0)}`
  if (currency === 'VND') return `₫${n.toFixed(0)}`
  if (currency === 'PHP') return `₱${n.toFixed(0)}`
  if (currency === 'AUD') return `A$${n.toFixed(0)}`
  return `${currency} ${n.toFixed(0)}`
}

export function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    'Food': '🍔',
    'Transport': '🚕',
    'Social': '👥',
    'Home': '🏠',
    'Family': '❤️',
    'Shopping': '🛍️',
    'Health': '💊',
    'Education': '📚',
    'Entertainment': '🎬',
    'Other': '📌',
  }
  return map[category] || '📌'
}

export function getLevelName(xp: number): string {
  if (xp < 200) return 'Starting out'
  if (xp < 500) return 'Getting curious'
  if (xp < 900) return 'Building habits'
  if (xp < 1400) return 'Finding flow'
  if (xp < 2000) return 'Money-smart'
  if (xp < 3000) return 'Sarathy champion'
  if (xp < 5000) return 'Financial guide'
  return 'Sarathy legend'
}

export function getMonthEntries(entries: BudgetEntry[]): BudgetEntry[] {
  const monthKey = todayInSingapore().slice(0, 7)
  return entries.filter(e => e.entry_date.slice(0, 7) === monthKey)
}
