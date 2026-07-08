import { getAuthHeaders } from '@/lib/api-auth'

export interface SavingsGoalSaveInput {
  goal: number
  goalName?: string | null
  goalTargetAmount?: number | null
  goalTargetDate?: string | null
}

export async function saveMonthlySavingsGoal(input: SavingsGoalSaveInput): Promise<void> {
  const res = await fetch('/api/profile/savings-goal', {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      goal: input.goal,
      goalName: input.goalName?.trim() || null,
      goalTargetAmount: input.goalTargetAmount ?? null,
      goalTargetDate: input.goalTargetDate?.trim() || null,
    }),
  })

  if (!res.ok) {
    throw new Error('Failed to save savings goal')
  }
}

export async function dismissSavingsGoalPrompt(): Promise<void> {
  const res = await fetch('/api/profile/savings-goal', {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ dismiss: true }),
  })

  if (!res.ok) {
    throw new Error('Failed to dismiss savings prompt')
  }
}
