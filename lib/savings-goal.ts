import { getAuthHeaders } from '@/lib/api-auth'

export async function saveMonthlySavingsGoal(
  goal: number
): Promise<void> {
  const res = await fetch('/api/profile/savings-goal', {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ goal }),
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
