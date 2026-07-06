import { calculateSafeToSpend, getLevelName } from '@/lib/calculations'
import { createServiceSupabaseClient } from '@/lib/supabase-admin'
import { getWiseMode } from '@/lib/wise'
import type { BudgetEntry, FixedSpending, Profile } from '@/types'
import { analyzeMoodTrend } from './mood-trend'
import { detectRecentNotables } from './notables'
import { analyzeRemittanceRhythm } from './remittance-rhythm'
import { analyzeSpendingPatterns } from './spending-patterns'
import { addDaysToDateString, todayInSingapore } from './sgt'
import type {
  BudgetEntryRow,
  CompanionContext,
  MoodLogRow,
  RemittanceLogRow,
} from './types'

export type { CompanionContext } from './types'

export async function buildCompanionContext(userId: string): Promise<CompanionContext> {
  const supabase = createServiceSupabaseClient()
  const today = todayInSingapore()
  const entriesSince = addDaysToDateString(today, -35)
  const moodSince = addDaysToDateString(today, -6)
  const remittanceSince = addDaysToDateString(today, -365)

  const [
    profileRes,
    entriesRes,
    fixedRes,
    moodRes,
    remittanceRes,
    finverseRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase
      .from('budget_entries')
      .select('category, amount, description, entry_date, logged_via, created_at')
      .eq('user_id', userId)
      .gte('entry_date', entriesSince)
      .order('entry_date', { ascending: false }),
    supabase
      .from('fixed_spending')
      .select('amount, due_day, is_active')
      .eq('user_id', userId)
      .eq('is_active', true),
    supabase
      .from('mood_logs')
      .select('mood, entry_date')
      .eq('user_id', userId)
      .gte('entry_date', moodSince)
      .order('entry_date', { ascending: true }),
    supabase
      .from('remittance_logs')
      .select('amount_sent, from_currency, created_at')
      .eq('user_id', userId)
      .gte('created_at', `${remittanceSince}T00:00:00+08:00`)
      .order('created_at', { ascending: false })
      .limit(24),
    supabase
      .from('finverse_connections')
      .select('institution_name, linked_at')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (profileRes.error || !profileRes.data) {
    throw new Error(`Profile not found for user ${userId}`)
  }

  const profile = profileRes.data as Profile
  const entries = (entriesRes.data ?? []) as BudgetEntryRow[]
  const fixedSpending = (fixedRes.data ?? []) as FixedSpending[]

  const safeData = calculateSafeToSpend(profile, entries as BudgetEntry[], fixedSpending)
  const spending = analyzeSpendingPatterns(entries)
  const mood = analyzeMoodTrend((moodRes.data ?? []) as MoodLogRow[])
  const remittance = analyzeRemittanceRhythm((remittanceRes.data ?? []) as RemittanceLogRow[])
  const recentNotables = detectRecentNotables(entries, safeData.safeToSpend)

  const spentToday = entries
    .filter((e) => e.entry_date === today)
    .reduce((sum, e) => sum + e.amount, 0)

  const wiseEntries = entries.filter((e) => e.logged_via === 'wise')
  const finverseEntries = entries.filter((e) => e.logged_via === 'finverse')
  const wiseMode = getWiseMode()

  const maxEntryDate = (rows: BudgetEntryRow[]) =>
    rows.length > 0
      ? rows.reduce((max, e) => (e.entry_date > max ? e.entry_date : max), rows[0].entry_date)
      : null

  const displayName = profile.name?.trim() || 'there'
  const firstName = displayName.split(/\s+/)[0] || displayName

  return {
    user: {
      name: displayName,
      firstName,
      currency: profile.primary_currency || 'SGD',
      companionVibe: profile.companion_vibe,
      homeCountry: profile.home_country,
      currentCountry: profile.current_country,
      moneyFear: profile.money_fear,
      responsibleFor: profile.responsible_for,
    },
    today: {
      safeToSpend: safeData.safeToSpend,
      status: safeData.status,
      daysLeftInMonth: safeData.daysLeft,
      budget: safeData.planAmount,
      spentThisMonth: safeData.alreadySpent,
      remainingBudget: Math.max(0, safeData.planAmount - safeData.alreadySpent),
      spentToday,
      savings: safeData.savings,
    },
    spending,
    gamification: {
      streak: profile.daily_login_streak ?? 0,
      totalXp: profile.total_xp ?? 0,
      levelName: getLevelName(profile.total_xp ?? 0),
    },
    mood,
    remittance,
    sync: {
      wise: {
        connected: wiseMode === 'real' || wiseEntries.length > 0,
        lastImportAt: maxEntryDate(wiseEntries),
        mode: wiseMode,
      },
      finverse: {
        connected: Boolean(finverseRes.data),
        institutionName: finverseRes.data?.institution_name ?? null,
        linkedAt: finverseRes.data?.linked_at ?? null,
        lastImportAt: maxEntryDate(finverseEntries),
      },
    },
    recentNotables,
    generatedAt: new Date().toISOString(),
  }
}
