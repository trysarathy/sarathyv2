import type { DreamProgress, Profile } from '@/types'

export type MoodValue = 'good' | 'anxious' | 'stressed'
export type MoodTrend = 'stable' | 'improving' | 'worsening' | 'mixed' | 'unknown'

export interface SpendingDeviation {
  category: string
  thisWeek: number
  baseline: number
  ratio: number
  label: string
}

export interface RecentNotable {
  kind: 'large_expense' | 'new_category'
  date: string
  category: string
  amount: number
  description: string | null
}

export interface CompanionContext {
  user: {
    name: string
    firstName: string
    currency: string
    companionVibe: Profile['companion_vibe']
    homeCountry: string | null
    currentCountry: string | null
    moneyFear: string | null
    responsibleFor: string | null
    preferredLanguage: string
  }
  today: {
    safeToSpend: number
    status: 'safe' | 'tight' | 'danger'
    daysLeftInMonth: number
    budget: number
    spentThisMonth: number
    remainingBudget: number
    spentToday: number
    savings: {
      monthlyGoal: number
      goalName: string | null
      status: 'none' | 'protected' | 'at_risk'
      stillPossible: number | null
      dream: DreamProgress | null
    }
  }
  spending: {
    thisWeekByCategory: Record<string, number>
    weeklyBaselineByCategory: Record<string, number>
    notableDeviations: SpendingDeviation[]
  }
  gamification: {
    streak: number
    totalXp: number
    levelName: string
  }
  mood: {
    last7: Array<{ date: string; mood: MoodValue }>
    trend: MoodTrend
    latest: MoodValue | null
  }
  remittance: {
    hasHistory: boolean
    typicalAmount: number | null
    typicalDayOfMonth: number | null
    lastSentAt: string | null
    currency: string
  } | null
  sync: {
    wise: { connected: boolean; lastImportAt: string | null; mode: 'mock' | 'real' }
    finverse: {
      connected: boolean
      institutionName: string | null
      linkedAt: string | null
      lastImportAt: string | null
    }
  }
  recentNotables: RecentNotable[]
  generatedAt: string
}

export interface BudgetEntryRow {
  category: string
  amount: number
  description: string | null
  entry_date: string
  logged_via: string
  created_at: string
}

export interface MoodLogRow {
  mood: string
  entry_date: string
}

export interface RemittanceLogRow {
  amount_sent: number
  from_currency: string
  created_at: string
}
