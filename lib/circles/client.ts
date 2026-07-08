import { getAuthHeaders } from '@/lib/api-auth'
import type { CircleMoment } from '@/types'

export interface CreateSplitInput {
  description: string
  total_amount: number
  category?: string
  participant_ids: string[]
}

export async function createCircleSplit(
  circleId: string,
  input: CreateSplitInput
): Promise<CircleMoment> {
  const res = await fetch(`/api/circles/${circleId}/splits`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(input),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create split')
  }
  return data.moment as CircleMoment
}

export async function claimCircleSplit(momentId: string): Promise<{
  already_claimed: boolean
  budget_entry_id: string | null
  share_amount: number
}> {
  const res = await fetch(`/api/circles/splits/${momentId}/claim`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({}),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Failed to add your share')
  }
  return data
}
