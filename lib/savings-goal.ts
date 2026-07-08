import { getAuthHeaders } from '@/lib/api-auth'

export async function saveMonthlySavingsGoal(
  goal: number,
  goalName?: string | null
): Promise<void> {
  const res = await fetch('/api/profile/savings-goal', {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      goal,
      goalName: goalName?.trim() || null,
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
