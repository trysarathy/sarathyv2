import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { createServiceSupabaseClient } from '@/lib/supabase-admin'
import { todayInSingapore } from '@/lib/sarathy/sgt'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'
import {
  getDailyBudgetSnapshot,
  shouldSendBudgetNudge,
} from '@/lib/nudge/daily-budget'
import { getBudgetWarningCopy } from '@/lib/notifications/nudge-copy'
import { sendPushToUser } from '@/lib/notifications/web-push'

/**
 * POST /api/nudge/after-expense
 * After an expense is saved for today — send at most one budget warning push per day.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const entryDate =
    typeof body?.entryDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(body.entryDate)
      ? body.entryDate.slice(0, 10)
      : todayInSingapore()

  const today = todayInSingapore()
  // Only nudge for expenses that count toward today
  if (entryDate !== today) {
    return NextResponse.json({ ok: true, skipped: 'not_today' })
  }

  const supabase = createServiceSupabaseClient()
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      'planning_amount, companion_vibe, primary_currency, notifications_enabled, last_nudge_sent'
    )
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!profile.notifications_enabled) {
    return NextResponse.json({ ok: true, skipped: 'notifications_disabled' })
  }

  if (!profile.planning_amount || profile.planning_amount <= 0) {
    return NextResponse.json({ ok: true, skipped: 'no_budget' })
  }

  if (profile.last_nudge_sent === today) {
    return NextResponse.json({ ok: true, skipped: 'already_nudged_today' })
  }

  const { data: todayEntries } = await supabase
    .from('budget_entries')
    .select('amount, entry_date')
    .eq('user_id', user.id)
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
  if (!kind) {
    return NextResponse.json({
      ok: true,
      skipped: 'healthy',
      remaining: snapshot.remaining,
      percentageRemaining: snapshot.percentageRemaining,
    })
  }

  const currency = getProfileDisplayCurrency(profile)
  const amountForCopy =
    kind === 'over' ? Math.abs(snapshot.remaining) : Math.max(0, snapshot.remaining)
  const copy = getBudgetWarningCopy(kind, profile.companion_vibe, amountForCopy, currency)

  // Mark sent first to avoid duplicate pushes on race
  const { error: stampError } = await supabase
    .from('profiles')
    .update({ last_nudge_sent: today })
    .eq('id', user.id)
    .or(`last_nudge_sent.is.null,last_nudge_sent.neq.${today}`)

  if (stampError) {
    // Column may not exist yet — still try to send
    console.warn('last_nudge_sent update failed:', stampError.message)
  }

  const result = await sendPushToUser(user.id, {
    title: copy.title,
    body: copy.body,
    url: '/home',
  })

  return NextResponse.json({
    ok: true,
    kind,
    ...result,
    title: copy.title,
    body: copy.body,
    remaining: snapshot.remaining,
  })
}
