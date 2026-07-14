/**
 * Verifies today-only safe-to-spend math and dream finalization idempotency.
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
import { todayInSingapore } from '../lib/sarathy/sgt'
import type { BudgetEntry, FixedSpending, Profile } from '../types'

const profile: Profile = {
  id: 'test-user',
  name: 'Ash',
  home_country: 'IN',
  current_country: 'SG',
  user_types: ['student'],
  primary_currency: 'SGD',
  language_preference: 'en',
  planning_amount: 3100,
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

/** Fixed calendar day for deterministic asserts (not "now"). */
const AS_OF = { year: 2026, month: 6, day: 11 } // 2026-07-11
const AS_OF_DATE = '2026-07-11'
const DAYS_LEFT = 31 - 11 + 1 // 21

const entries: BudgetEntry[] = [
  {
    id: 'e-today',
    user_id: 'test-user',
    category: 'Food',
    amount: 50,
    description: 'Lunch today',
    entry_date: AS_OF_DATE,
    payment_method: null,
    logged_via: 'manual',
    created_at: '2026-07-11T10:00:00Z',
  },
  {
    id: 'e-past',
    user_id: 'test-user',
    category: 'Shopping',
    amount: 900,
    description: 'Past overspend',
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

function assertTrue(label: string, cond: boolean) {
  if (!cond) {
    console.error(`FAIL ${label}`)
    failures++
  } else {
    console.log(`OK   ${label}`)
  }
}

const snapshot = calculateSafeToSpendAsOf(profile, entries, fixed, AS_OF)
const dailyBudget = Math.round(3100 / DAYS_LEFT)
const expectedSafe = Math.max(0, Math.round(dailyBudget - 50))

assertEqual('spentToday is only as-of day', snapshot.spentToday, 50)
assertEqual('alreadySpent includes whole month', snapshot.alreadySpent, 950)
assertEqual('dailyBudget = plan ÷ daysLeft', snapshot.dailyBudget, dailyBudget)
assertEqual(
  'safeToSpend ignores past-day overspend',
  snapshot.safeToSpend,
  expectedSafe
)
assertTrue(
  'past overspend does not zero out today',
  snapshot.safeToSpend > 0 && snapshot.alreadySpent > snapshot.planAmount * 0.2
)

const todaySgt = todayInSingapore()
const [y, m, d] = todaySgt.split('-').map(Number)
const wrapped = calculateSafeToSpend(profile, entries, fixed)
const asOfToday = calculateSafeToSpendAsOf(profile, entries, fixed, {
  year: y,
  month: m - 1,
  day: d,
})

assertEqual(
  'calculateSafeToSpend === calculateSafeToSpendAsOf(SGT today)',
  stripDream(wrapped),
  stripDream(asOfToday)
)

const julyProfile: Profile = {
  ...profile,
  goal_started_at: '2026-07-01',
  goal_progress_through_month: null,
  goal_saved_amount: 0,
}

const finalizeAsOf = '2026-08-01'
const first = computeDreamFinalization(julyProfile, entries, fixed, finalizeAsOf)
if (!first) {
  console.error('FAIL finalize produced a patch for July')
  failures++
} else {
  console.log('OK   finalize credits July when protected at month-end')
  const afterFirst: Profile = { ...julyProfile, ...first }
  const second = computeDreamFinalization(afterFirst, entries, fixed, finalizeAsOf)
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
  goal_progress_through_month: addMonthsToMonthKey(finalizeAsOf.slice(0, 7), -1),
  goal_saved_amount: 150,
}
const noop = computeDreamFinalization(caughtUp, entries, fixed, finalizeAsOf)
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
