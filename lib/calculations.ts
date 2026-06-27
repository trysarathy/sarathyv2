import { BudgetEntry, FixedSpending, Profile, SafeToSpendData, SafetyStatus, PLCategory } from '@/types'

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
  const currency = profile.primary_currency || 'SGD'
  const planAmount = profile.planning_amount || 0

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

  // Free money
  const freeToUse = planAmount - fixedLeft - alreadySpent - buffer
  const safeToSpend = Math.max(0, Math.round(freeToUse / Math.max(daysLeft, 1)))

  // Safety status
  const dailyIdeal = planAmount / daysInMonth
  let status: SafetyStatus = 'safe'
  if (safeToSpend <= 0) status = 'danger'
  else if (safeToSpend < dailyIdeal * 0.5) status = 'tight'

  // Safety line in plain language
  let safetyLine = ''
  if (status === 'safe') {
    safetyLine = `You're safe through the ${daysInMonth}th`
  } else if (status === 'tight') {
    safetyLine = `A bit tight - watch spending through the ${daysInMonth}th`
  } else {
    safetyLine = `At risk this week - let's fix it`
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
  const rounded = amount.toFixed(0)
  const symbols: Record<string, string> = {
    SGD: 'S$',
    INR: 'Rs ',
    USD: '$',
    GBP: 'GBP ',
    AUD: 'A$',
    CAD: 'C$',
    MYR: 'RM ',
    EUR: 'EUR ',
    CNY: 'CNY ',
    VND: 'VND ',
    PHP: 'PHP ',
    BDT: 'BDT ',
  }

  return `${symbols[currency] || `${currency} `}${rounded}`
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
  const now = new Date()
  return entries.filter(e => {
    const d = new Date(e.entry_date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
}
