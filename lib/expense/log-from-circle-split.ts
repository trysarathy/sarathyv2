import type { SupabaseClient } from '@supabase/supabase-js'
import { todayInSingapore } from '@/lib/sarathy/sgt'
import { isExpenseSplitContent, shareForUser } from '@/lib/circles/split-expense'
import { normalizeExpenseCategory } from '@/lib/expense/categories'
import type { ExpenseSplitContent } from '@/types'

const XP_AWARD = 10

export interface ClaimSplitResult {
  already_claimed: boolean
  budget_entry_id: string | null
  share_amount: number
}

export async function assertCircleMember(
  supabase: SupabaseClient,
  circleId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('circle_members')
    .select('id')
    .eq('circle_id', circleId)
    .eq('user_id', userId)
    .maybeSingle()
  return Boolean(data)
}

export async function getCircleMemberIds(
  supabase: SupabaseClient,
  circleId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('circle_members')
    .select('user_id')
    .eq('circle_id', circleId)

  if (error) throw error
  return (data ?? []).map(row => row.user_id as string)
}

export async function claimCircleSplitShare(
  supabase: SupabaseClient,
  userId: string,
  moment: {
    id: string
    circle_id: string
    type: string
    content: unknown
  }
): Promise<ClaimSplitResult> {
  if (moment.type !== 'expense_split' || !isExpenseSplitContent(moment.content)) {
    throw new Error('Not an expense split moment')
  }

  const content = moment.content as ExpenseSplitContent
  const shareAmount = shareForUser(content, userId)
  if (shareAmount == null) {
    throw new Error('You are not a participant in this split')
  }

  const isMember = await assertCircleMember(supabase, moment.circle_id, userId)
  if (!isMember) {
    throw new Error('Not a member of this circle')
  }

  const { data: existing } = await supabase
    .from('budget_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('source_circle_moment_id', moment.id)
    .maybeSingle()

  if (existing?.id) {
    return {
      already_claimed: true,
      budget_entry_id: existing.id,
      share_amount: shareAmount,
    }
  }

  const entryDate = todayInSingapore()
  const category = normalizeExpenseCategory(content.category)

  const { data: inserted, error: insertError } = await supabase
    .from('budget_entries')
    .insert({
      user_id: userId,
      category,
      amount: shareAmount,
      description: `${content.description} (circle split)`,
      entry_date: entryDate,
      logged_via: 'circle_split',
      source_circle_moment_id: moment.id,
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: dup } = await supabase
        .from('budget_entries')
        .select('id')
        .eq('user_id', userId)
        .eq('source_circle_moment_id', moment.id)
        .maybeSingle()
      return {
        already_claimed: true,
        budget_entry_id: dup?.id ?? null,
        share_amount: shareAmount,
      }
    }
    throw insertError
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('total_xp')
    .eq('id', userId)
    .single()

  if (profile) {
    await supabase
      .from('profiles')
      .update({ total_xp: (profile.total_xp ?? 0) + XP_AWARD })
      .eq('id', userId)
  }

  return {
    already_claimed: false,
    budget_entry_id: inserted?.id ?? null,
    share_amount: shareAmount,
  }
}
