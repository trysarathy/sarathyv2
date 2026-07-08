import { BudgetEntry, FixedSpending, Profile, SafeToSpendData, SafetyStatus, PLCategory } from '@/types'
import { todayInSingapore } from '@/lib/sarathy/sgt'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'

export function calculateSafeToSpend(
  profile: Profile,
  entries: BudgetEntry[],
  fixedSpending: FixedSpending[]
): SafeToSpendData {
  const now = new Date()
  const today = now.getDate()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysLeft = daysInMonth - today + 1
  const currency = getProfileDisplayCurrency(profile)
  const planAmount = profile.planning_amount || 0
  const savingsGoal = profile.monthly_savings_goal ?? 0

  // Fixed costs still due this month
  const fixedLeft = fixedSpending
    .filter(f => f.is_active && (f.due_day || 1) >= today)
    .reduce((sum, f) => sum + f.amount, 0)

  // Already spent this month
  const currentMonthEntries = entries.filter(e => {
    const entryDate = new Date(e.entry_date)
    return entryDate.getMonth() === month && entryDate.getFullYear() === year
  })
  const alreadySpent = currentMonthEntries.reduce((sum, e) => sum + e.amount, 0)

  // 10% safety buffer
  const buffer = planAmount * 0.10

  const roomAfterEssentials = planAmount - fixedLeft - alreadySpent - buffer
  const freeToUse = roomAfterEssentials - savingsGoal
  const safeToSpend = Math.max(0, Math.round(freeToUse / Math.max(daysLeft, 1)))

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

  // Safety status
  const dailyIdeal = planAmount / daysInMonth
  let status: SafetyStatus = 'safe'
  if (safeToSpend <= 0) status = 'danger'
  else if (safeToSpend < dailyIdeal * 0.5) status = 'tight'

  // Safety line in plain language
  const safeUntilDay = Math.round(today + (freeToUse / Math.max(alreadySpent / Math.max(today, 1), 1)))
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
    buffer,
    freeToUse: Math.max(0, freeToUse),
    daysLeft,
    currency,
    savings: {
      monthlyGoal: savingsGoal,
      goalName: profile.goal_name?.trim() || null,
      status: savingsStatus,
      stillPossible,
    },
  }
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
  if (currency === 'SGD') return `S$${amount.toFixed(0)}`
  if (currency === 'INR') return `₹${amount.toFixed(0)}`
  if (currency === 'USD') return `$${amount.toFixed(0)}`
  if (currency === 'GBP') return `£${amount.toFixed(0)}`
  return `${currency} ${amount.toFixed(0)}`
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
