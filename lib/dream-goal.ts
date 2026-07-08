import { calculateSafeToSpendAsOf, formatCurrency } from '@/lib/calculations'
import type { SafeToSpendAsOf } from '@/lib/calculations'
import type {
  BudgetEntry,
  DreamProgress,
  FixedSpending,
  Profile,
  SafeToSpendData,
  SavingsProtectionStatus,
} from '@/types'

export interface DreamFinalizationPatch {
  goal_saved_amount: number
  goal_progress_through_month?: string
  goal_started_at?: string
}

/** YYYY-MM calendar month plus delta months. */
export function addMonthsToMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/** Last calendar day of YYYY-MM as SafeToSpendAsOf (local date parts). */
export function monthKeyToMonthEnd(monthKey: string): SafeToSpendAsOf {
  const [year, month1] = monthKey.split('-').map(Number)
  const month0 = month1 - 1
  const day = new Date(year, month1, 0).getDate()
  return { year, month: month0, day }
}

function calendarMonthsRemaining(fromMonthKey: string, targetDate: string): number {
  const toMonthKey = targetDate.slice(0, 7)
  const [fy, fm] = fromMonthKey.split('-').map(Number)
  const [ty, tm] = toMonthKey.split('-').map(Number)
  const months = (ty - fy) * 12 + (tm - fm) + 1
  return Math.max(1, months)
}

function formatTargetDateLabel(targetDate: string, todaySgt: string): string {
  const targetYear = targetDate.slice(0, 4)
  const todayYear = todaySgt.slice(0, 4)
  const month = new Date(`${targetDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short' })
  return targetYear === todayYear ? month : `${month} ${targetYear}`
}

/**
 * Pure: compute ledger updates for completed months not yet finalized.
 * Returns null when nothing to write (idempotent no-op).
 */
export function computeDreamFinalization(
  profile: Profile,
  entries: BudgetEntry[],
  fixedSpending: FixedSpending[],
  todaySgt: string
): DreamFinalizationPatch | null {
  const monthlyGoal = profile.monthly_savings_goal ?? 0
  if (monthlyGoal <= 0) return null

  const currentMonthKey = todaySgt.slice(0, 7)
  const previousMonthKey = addMonthsToMonthKey(currentMonthKey, -1)

  let goalStartedAt = profile.goal_started_at ?? null
  let backfillStartedAt: string | undefined

  if (!goalStartedAt) {
    goalStartedAt = `${currentMonthKey}-01`
    backfillStartedAt = goalStartedAt
  }

  const startMonthKey = goalStartedAt.slice(0, 7)
  const through = profile.goal_progress_through_month ?? null

  let firstToProcess = through ? addMonthsToMonthKey(through, 1) : startMonthKey
  if (firstToProcess < startMonthKey) firstToProcess = startMonthKey

  if (firstToProcess > previousMonthKey) {
    if (backfillStartedAt && !profile.goal_started_at) {
      return {
        goal_saved_amount: profile.goal_saved_amount ?? 0,
        goal_started_at: backfillStartedAt,
      }
    }
    return null
  }

  let savedAmount = profile.goal_saved_amount ?? 0
  let lastProcessed = through

  for (let monthKey = firstToProcess; monthKey <= previousMonthKey; monthKey = addMonthsToMonthKey(monthKey, 1)) {
    const asOf = monthKeyToMonthEnd(monthKey)
    const snapshot = calculateSafeToSpendAsOf(profile, entries, fixedSpending, asOf)
    if (snapshot.savings.status === 'protected') {
      savedAmount += monthlyGoal
    }
    lastProcessed = monthKey
  }

  if (lastProcessed === through && !backfillStartedAt) return null

  const patch: DreamFinalizationPatch = {
    goal_saved_amount: savedAmount,
    goal_progress_through_month: lastProcessed!,
  }
  if (backfillStartedAt) patch.goal_started_at = backfillStartedAt
  return patch
}

type ProfileUpdater = {
  from: (table: string) => {
    update: (data: Record<string, unknown>) => {
      eq: (column: string, value: string) => PromiseLike<{ error: { message: string } | null }>
    }
  }
}

/** Persist month-end ledger updates; returns merged profile or null if no-op. */
export async function finalizeDreamMonths(
  supabase: ProfileUpdater,
  userId: string,
  profile: Profile,
  entries: BudgetEntry[],
  fixedSpending: FixedSpending[],
  todaySgt: string
): Promise<Profile | null> {
  const patch = computeDreamFinalization(profile, entries, fixedSpending, todaySgt)
  if (!patch) return null

  const { error } = await supabase
    .from('profiles')
    .update(patch as unknown as Record<string, unknown>)
    .eq('id', userId)
  if (error) throw new Error(error.message)

  return { ...profile, ...patch }
}

export function computeDreamProgress(
  profile: Profile,
  savingsStatus: SavingsProtectionStatus,
  todaySgt: string
): DreamProgress | null {
  const monthlyGoal = Number(profile.monthly_savings_goal ?? 0)
  const targetAmountRaw = profile.goal_target_amount
  const targetAmountNum = targetAmountRaw != null ? Number(targetAmountRaw) : NaN
  const targetAmount = Number.isFinite(targetAmountNum) && targetAmountNum > 0 ? targetAmountNum : null
  const targetDate = profile.goal_target_date?.slice(0, 10) ?? null

  if (monthlyGoal <= 0 && !targetAmount) return null

  const savedFinalized = Number(profile.goal_saved_amount ?? 0)
  const currentMonthCredit = savingsStatus === 'protected' ? monthlyGoal : 0
  const savedSoFar = savedFinalized + currentMonthCredit

  const goalName = profile.goal_name?.trim() || null

  if (!targetAmount || targetAmount <= 0 || !targetDate) {
    return {
      goalName,
      monthlyGoal,
      targetAmount,
      targetDate,
      savedSoFar,
      savedFinalized,
      monthsRemaining: null,
      requiredMonthly: null,
      onTrack: null,
      targetDateLabel: null,
      funded: false,
    }
  }

  const funded = savedSoFar >= targetAmount
  const currentMonthKey = todaySgt.slice(0, 7)
  const monthsRemaining = calendarMonthsRemaining(currentMonthKey, targetDate)
  const remaining = Math.max(0, targetAmount - savedFinalized)
  const requiredMonthly = Math.ceil(remaining / monthsRemaining)
  const onTrack = monthlyGoal >= requiredMonthly

  return {
    goalName,
    monthlyGoal,
    targetAmount,
    targetDate,
    savedSoFar,
    savedFinalized,
    monthsRemaining,
    requiredMonthly,
    onTrack,
    targetDateLabel: formatTargetDateLabel(targetDate, todaySgt),
    funded,
  }
}

/** Compact dream line for LLM companion context. */
export function formatDreamContextLine(dream: DreamProgress, currency: string): string | null {
  if (!dream.targetAmount || !dream.targetDate) return null

  const label = dream.goalName ? `"${dream.goalName}"` : 'dream'
  const target = formatCurrency(dream.targetAmount, currency)
  const saved = formatCurrency(Math.min(dream.savedSoFar, dream.targetAmount), currency)
  const monthly = formatCurrency(dream.monthlyGoal, currency)

  if (dream.funded) {
    return `dream ${label}: ${target} fully funded`
  }

  if (dream.onTrack && dream.targetDateLabel) {
    return `dream ${label}: ${saved} of ${target} saved · on track for ${dream.targetDateLabel} (${monthly}/mo protected)`
  }

  if (dream.requiredMonthly != null) {
    const needed = formatCurrency(dream.requiredMonthly, currency)
    return `dream ${label}: ${saved} of ${target} saved · needs ${needed}/mo to stay on track (${monthly}/mo set)`
  }

  return `dream ${label}: ${saved} of ${target} saved`
}

/** Hero copy helper — funded line is static text only. */
export function formatDreamHeroLine(dream: DreamProgress, currency: string): string | null {
  if (!dream.targetAmount) return null

  const label = dream.goalName ?? 'Dream'
  const target = formatCurrency(dream.targetAmount, currency)

  if (dream.funded) {
    return `🛡️ ${label}: ${target} · funded 🎉`
  }

  const saved = formatCurrency(Math.min(dream.savedSoFar, dream.targetAmount), currency)

  if (dream.onTrack && dream.targetDateLabel) {
    return `🛡️ ${label}: ${saved} of ${target} · on track for ${dream.targetDateLabel}`
  }

  if (dream.requiredMonthly != null) {
    const needed = formatCurrency(dream.requiredMonthly, currency)
    return `🛡️ ${label}: ${saved} of ${target} · needs ${needed}/month to stay on track`
  }

  return `🛡️ ${label}: ${saved} of ${target}`
}

export function attachDreamProgress(
  safeData: SafeToSpendData,
  profile: Profile,
  todaySgt: string
): SafeToSpendData {
  const dream = computeDreamProgress(profile, safeData.savings.status, todaySgt)
  return {
    ...safeData,
    savings: {
      ...safeData.savings,
      dream,
    },
  }
}

/** Suggested monthly when target + date are set (UI step 5). */
export function suggestMonthlyAmount(
  targetAmount: number,
  savedFinalized: number,
  targetDate: string,
  todaySgt: string
): number {
  const currentMonthKey = todaySgt.slice(0, 7)
  const monthsRemaining = calendarMonthsRemaining(currentMonthKey, targetDate)
  const remaining = Math.max(0, targetAmount - savedFinalized)
  return Math.max(1, Math.ceil(remaining / monthsRemaining))
}
