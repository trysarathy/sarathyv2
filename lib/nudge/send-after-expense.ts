import { createServiceSupabaseClient } from '@/lib/supabase-admin'
import { todayInSingapore } from '@/lib/sarathy/sgt'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'
import {
  getDailyBudgetSnapshot,
  shouldSendBudgetNudge,
} from '@/lib/nudge/daily-budget'
import { getBudgetWarningCopy } from '@/lib/notifications/nudge-copy'
import { sendPushToUser } from '@/lib/notifications/web-push'

/** Fire-and-forget safe: never throws to callers. */
export async function maybeSendBudgetNudgeAfterExpense(
  userId: string,
  entryDate?: string
): Promise<{ ok: boolean; skipped?: string }> {
  try {
    const today = todayInSingapore()
    const date =
      entryDate && /^\d{4}-\d{2}-\d{2}/.test(entryDate) ? entryDate.slice(0, 10) : today
    if (date !== today) return { ok: true, skipped: 'not_today' }

    const supabase = createServiceSupabaseClient()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(
        'planning_amount, companion_vibe, primary_currency, notifications_enabled, last_nudge_sent'
      )
      .eq('id', userId)
      .single()

    if (profileError || !profile) return { ok: false, skipped: 'no_profile' }
    if (!profile.notifications_enabled) return { ok: true, skipped: 'notifications_disabled' }
    if (!profile.planning_amount || profile.planning_amount <= 0) {
      return { ok: true, skipped: 'no_budget' }
    }
    if (profile.last_nudge_sent === today) return { ok: true, skipped: 'already_nudged_today' }

    const { data: todayEntries } = await supabase
      .from('budget_entries')
      .select('amount, entry_date')
      .eq('user_id', userId)
      .eq('entry_date', today)

    const todaySpent = (todayEntries || []).reduce(
      (sum, e) => sum + (Number(e.amount) || 0),
      0
    )

    const snapshot = getDailyBudgetSnapshot({
      planningAmount: profile.planning_amount,
      todaySpent,
    })

    const kind = shouldSendBudgetNudge(snapshot.percentageRemaining)
    if (!kind) return { ok: true, skipped: 'healthy' }

    const currency = getProfileDisplayCurrency(profile)
    const amountForCopy =
      kind === 'over' ? Math.abs(snapshot.remaining) : Math.max(0, snapshot.remaining)
    const copy = getBudgetWarningCopy(kind, profile.companion_vibe, amountForCopy, currency)

    const { error: stampError } = await supabase
      .from('profiles')
      .update({ last_nudge_sent: today })
      .eq('id', userId)

    if (stampError) {
      console.warn('last_nudge_sent update failed:', stampError.message)
    }

    await sendPushToUser(userId, {
      title: copy.title,
      body: copy.body,
      url: '/home',
    })

    return { ok: true }
  } catch (err) {
    console.warn('maybeSendBudgetNudgeAfterExpense failed:', err)
    return { ok: false, skipped: 'error' }
  }
}
