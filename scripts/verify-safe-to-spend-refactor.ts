/**
 * Verifies calculateSafeToSpendAsOf(today) matches a direct inline replica of the
 * pre-refactor calculateSafeToSpend implementation (byte-identical JSON).
 * Also checks dream finalization idempotency.
 *
 * Run: npm run verify:safe-to-spend
 */
import {
  calculateSafeToSpend,
  calculateSafeToSpendAsOf,
} from '../lib/calculations'
import {
  addMonthsToMonthKey,
  computeDreamFinalization,
} from '../lib/dream-goal'
import type { BudgetEntry, FixedSpending, Profile } from '../types'

function legacyCalculateSafeToSpend(
  profile: Profile,
  entries: BudgetEntry[],
  fixedSpending: FixedSpending[]
) {
  const now = new Date()
  const today = now.getDate()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysLeft = daysInMonth - today + 1
  const planAmount = profile.planning_amount || 0
  const savingsGoal = profile.monthly_savings_goal ?? 0

  const fixedLeft = fixedSpending
    .filter(f => f.is_active && (f.due_day || 1) >= today)
    .reduce((sum, f) => sum + f.amount, 0)

  const currentMonthEntries = entries.filter(e => {
    const entryDate = new Date(e.entry_date)
    return entryDate.getMonth() === month && entryDate.getFullYear() === year
  })
  const alreadySpent = currentMonthEntries.reduce((sum, e) => sum + e.amount, 0)

  const buffer = planAmount * 0.10
  const roomAfterEssentials = planAmount - fixedLeft - alreadySpent - buffer
  const freeToUse = roomAfterEssentials - savingsGoal
  const safeToSpend = Math.max(0, Math.round(freeToUse / Math.max(daysLeft, 1)))

  let savingsStatus: 'none' | 'protected' | 'at_risk' = 'none'
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
  let status: 'safe' | 'tight' | 'danger' = 'safe'
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
    buffer,
    freeToUse: Math.max(0, freeToUse),
    daysLeft,
    savingsStatus,
    stillPossible,
  }
}

const profile: Profile = {
  id: 'test-user',
  name: 'Ash',
  home_country: 'IN',
  current_country: 'SG',
  user_types: ['student'],
  primary_currency: 'SGD',
  language_preference: 'en',
  planning_amount: 2000,
  total_money: null,
  money_type: null,
  responsible_for: null,
  money_fear: null,
  income_timing: null,
  companion_vibe: 'calm_mentor',
  daily_login_streak: 5,
  last_login_date: null,
  total_xp: 300,
  level: 1,
  achievements: [],
  onboarding_complete: true,
  colour_theme: 'saffron',
  quiet_mode_until: null,
  monthly_savings_goal: 150,
  goal_name: 'Bali fund',
  created_at: '2026-01-01T00:00:00Z',
}

const fixed: FixedSpending[] = [
  {
    id: '1',
    user_id: 'test-user',
    name: 'Rent',
    emoji: '🏠',
    amount: 800,
    frequency: 'monthly',
    due_day: 28,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
]

const entries: BudgetEntry[] = [
  {
    id: 'e1',
    user_id: 'test-user',
    category: 'Food',
    amount: 120,
    description: 'Lunch',
    entry_date: '2026-07-08',
    payment_method: null,
    logged_via: 'manual',
    created_at: '2026-07-08T10:00:00Z',
  },
  {
    id: 'e2',
    user_id: 'test-user',
    category: 'Transport',
    amount: 40,
    description: null,
    entry_date: '2026-07-05',
    payment_method: null,
    logged_via: 'manual',
    created_at: '2026-07-05T10:00:00Z',
  },
]

function stripDream(data: ReturnType<typeof calculateSafeToSpend>) {
  const { dream: _, ...savingsRest } = data.savings
  return { ...data, savings: savingsRest }
}

let failures = 0

function assertEqual(label: string, a: unknown, b: unknown) {
  const aj = JSON.stringify(a)
  const bj = JSON.stringify(b)
  if (aj !== bj) {
    console.error(`FAIL ${label}`)
    console.error('  expected:', bj)
    console.error('  actual:  ', aj)
    failures++
  } else {
    console.log(`OK   ${label}`)
  }
}

const legacy = legacyCalculateSafeToSpend(profile, entries, fixed)
const wrapped = calculateSafeToSpend(profile, entries, fixed)
const asOfToday = calculateSafeToSpendAsOf(profile, entries, fixed, {
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  day: new Date().getDate(),
})

assertEqual(
  'wrapper matches legacy core fields',
  {
    safeToSpend: legacy.safeToSpend,
    status: legacy.status,
    safetyLine: legacy.safetyLine,
    planAmount: legacy.planAmount,
    fixedLeft: legacy.fixedLeft,
    alreadySpent: legacy.alreadySpent,
    buffer: legacy.buffer,
    freeToUse: legacy.freeToUse,
    daysLeft: legacy.daysLeft,
  },
  {
    safeToSpend: wrapped.safeToSpend,
    status: wrapped.status,
    safetyLine: wrapped.safetyLine,
    planAmount: wrapped.planAmount,
    fixedLeft: wrapped.fixedLeft,
    alreadySpent: wrapped.alreadySpent,
    buffer: wrapped.buffer,
    freeToUse: wrapped.freeToUse,
    daysLeft: wrapped.daysLeft,
  }
)

assertEqual(
  'calculateSafeToSpend === calculateSafeToSpendAsOf(today)',
  stripDream(wrapped),
  stripDream(asOfToday)
)

const todaySgt = '2026-08-01'
const julyProfile: Profile = {
  ...profile,
  goal_started_at: '2026-07-01',
  goal_progress_through_month: null,
  goal_saved_amount: 0,
}

const first = computeDreamFinalization(julyProfile, entries, fixed, todaySgt)
if (!first) {
  console.error('FAIL finalize produced a patch for July')
  failures++
} else {
  console.log('OK   finalize credits July when protected at month-end')
  const afterFirst: Profile = { ...julyProfile, ...first }
  const second = computeDreamFinalization(afterFirst, entries, fixed, todaySgt)
  if (second !== null) {
    console.error('FAIL finalize is not idempotent on second run', second)
    failures++
  } else {
    console.log('OK   finalize is idempotent on second run')
  }
}

const caughtUp: Profile = {
  ...julyProfile,
  goal_started_at: '2026-07-01',
  goal_progress_through_month: addMonthsToMonthKey(todaySgt.slice(0, 7), -1),
  goal_saved_amount: 150,
}
const noop = computeDreamFinalization(caughtUp, entries, fixed, todaySgt)
if (noop !== null) {
  console.error('FAIL expected null when already finalized through previous month', noop)
  failures++
} else {
  console.log('OK   finalize no-op when ledger is current')
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}

console.log('\nAll checks passed')
