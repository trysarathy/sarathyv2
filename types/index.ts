export interface Profile {
  id: string
  name: string | null
  home_country: string | null
  current_country: string | null
  user_types: string[]
  primary_currency: string
  secondary_currency?: string | null
  language_preference: string | null
  planning_amount: number | null
  total_money: number | null
  money_type: string | null
  responsible_for: string | null
  money_fear: string | null
  income_timing: string | null
  companion_vibe: 'calm_mentor' | 'hype_friend' | 'no_nonsense_sibling'
  daily_login_streak: number
  last_login_date: string | null
  total_xp: number
  level: number
  achievements: string[]
  onboarding_complete: boolean
  colour_theme: string
  quiet_mode_until: string | null
  monthly_savings_goal?: number
  savings_goal_prompt_dismissed?: boolean
  goal_name?: string | null
  goal_target_amount?: number | null
  goal_target_date?: string | null
  goal_saved_amount?: number
  goal_progress_through_month?: string | null
  goal_started_at?: string | null
  created_at: string
}

export interface BudgetEntry {
  id: string
  user_id: string
  category: string
  amount: number
  description: string | null
  entry_date: string
  payment_method: string | null
  logged_via: string
  source_circle_moment_id?: string | null
  created_at: string
}

export interface FixedSpending {
  id: string
  user_id: string
  name: string
  emoji: string
  amount: number
  frequency: string
  due_day: number | null
  is_active: boolean
  created_at: string
}

export interface Goal {
  id: string
  user_id: string
  name: string
  emoji: string
  target_amount: number
  current_amount: number
  deadline: string | null
  user_caption: string | null
  created_at: string
}

export interface MoodLog {
  id: string
  user_id: string
  mood: string
  entry_date: string
  created_at: string
}

export interface ChatMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface MoneyAllocation {
  id: string
  user_id: string
  name: string
  emoji: string
  amount: number
  created_at: string
}

export type SafetyStatus = 'safe' | 'tight' | 'danger'
export type SavingsProtectionStatus = 'none' | 'protected' | 'at_risk'

export interface DreamProgress {
  goalName: string | null
  monthlyGoal: number
  targetAmount: number | null
  targetDate: string | null
  savedSoFar: number
  savedFinalized: number
  monthsRemaining: number | null
  requiredMonthly: number | null
  onTrack: boolean | null
  targetDateLabel: string | null
  funded: boolean
}

export interface SafeToSpendData {
  safeToSpend: number
  status: SafetyStatus
  safetyLine: string
  planAmount: number
  fixedLeft: number
  alreadySpent: number
  /** Sum of expenses logged for the as-of calendar day only. */
  spentToday: number
  /** planAmount ÷ daysLeft — today's daily budget before today's spend. */
  dailyBudget: number
  buffer: number
  freeToUse: number
  daysLeft: number
  currency: string
  savings: {
    monthlyGoal: number
    goalName: string | null
    status: SavingsProtectionStatus
    stillPossible: number | null
    dream: DreamProgress | null
  }
}

export interface PLCategory {
  category: string
  total: number
  entries: BudgetEntry[]
  percentage: number
}

export interface ExpenseSplitContent {
  description: string
  total_amount: number
  currency: string
  participant_ids: string[]
  share_amount: number
  split_count: number
  category: string
  shares_by_user: Record<string, number>
}

export interface CircleMemberWithProfile {
  user_id: string
  display_name: string | null
  name: string | null
}

export interface CircleMoment {
  id: string
  circle_id: string
  sender_id: string
  type: string
  content: ExpenseSplitContent | Record<string, unknown>
  reactions: string[]
  created_at: string
}
