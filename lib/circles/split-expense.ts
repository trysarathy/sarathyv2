import type { ExpenseSplitContent } from '@/types'

export interface EqualSplitResult {
  share_amount: number
  /** Per-participant share; payer (first in list) may get +remainder cents. */
  shares_by_user: Record<string, number>
}

/**
 * Equal split with remainder cents assigned to payerId so shares sum to total.
 */
export function computeEqualSplit(
  totalAmount: number,
  participantIds: string[],
  payerId: string
): EqualSplitResult {
  const n = participantIds.length
  if (n < 2) {
    throw new Error('At least 2 participants required')
  }
  const total = Math.round(totalAmount * 100) / 100
  if (total <= 0) {
    throw new Error('Amount must be greater than zero')
  }

  const baseShare = Math.floor((total * 100) / n) / 100
  let remainderCents = Math.round(total * 100) - Math.round(baseShare * 100) * n

  const shares_by_user: Record<string, number> = {}
  for (const id of participantIds) {
    shares_by_user[id] = baseShare
  }

  const payerIndex = participantIds.indexOf(payerId)
  const assignOrder =
    payerIndex >= 0
      ? [payerId, ...participantIds.filter(id => id !== payerId)]
      : participantIds

  let i = 0
  while (remainderCents > 0) {
    const uid = assignOrder[i % assignOrder.length]
    shares_by_user[uid] = Math.round((shares_by_user[uid] + 0.01) * 100) / 100
    remainderCents -= 1
    i += 1
  }

  const payerShare = shares_by_user[payerId] ?? baseShare

  return {
    share_amount: payerShare,
    shares_by_user,
  }
}

export function buildExpenseSplitContent(params: {
  description: string
  totalAmount: number
  currency: string
  participantIds: string[]
  payerId: string
  category: string
}): ExpenseSplitContent {
  const { shares_by_user } = computeEqualSplit(
    params.totalAmount,
    params.participantIds,
    params.payerId
  )

  return {
    description: params.description.trim(),
    total_amount: Math.round(params.totalAmount * 100) / 100,
    currency: params.currency,
    participant_ids: params.participantIds,
    share_amount: shares_by_user[params.payerId],
    split_count: params.participantIds.length,
    category: params.category,
    shares_by_user,
  }
}

export function shareForUser(content: ExpenseSplitContent, userId: string): number | null {
  if (!content.participant_ids.includes(userId)) return null
  return content.shares_by_user[userId] ?? content.share_amount
}

export function isExpenseSplitContent(content: unknown): content is ExpenseSplitContent {
  if (!content || typeof content !== 'object') return false
  const c = content as ExpenseSplitContent
  return (
    typeof c.description === 'string' &&
    typeof c.total_amount === 'number' &&
    typeof c.currency === 'string' &&
    Array.isArray(c.participant_ids) &&
    typeof c.share_amount === 'number' &&
    typeof c.split_count === 'number' &&
    typeof c.shares_by_user === 'object'
  )
}
