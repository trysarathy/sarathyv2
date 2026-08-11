import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { createServiceSupabaseClient } from '@/lib/supabase-admin'
import { sendPushToUser, sendPushToSubscription } from '@/lib/notifications/web-push'
import { getReminderCopy } from '@/lib/notifications/copy'
import { getMorningSafeCopy } from '@/lib/notifications/nudge-copy'
import { addDaysToDateString, todayInSingapore } from '@/lib/sarathy/sgt'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'
import {
  getDailyBudgetSnapshot,
  topSpendCategoryForDate,
} from '@/lib/nudge/daily-budget'

/**
 * POST /api/send-notification
 * - Authenticated user + { preview: true } → send reminder to self
 * - Cron/admin with Authorization: Bearer CRON_SECRET → fan-out morning safe-to-spend
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('Authorization') || ''
  const isCron =
    Boolean(cronSecret) &&
    (authHeader === `Bearer ${cronSecret}` || req.headers.get('x-cron-secret') === cronSecret)

  if (isCron || body?.mode === 'daily') {
    if (!isCron && body?.mode === 'daily') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(await runMorningSafeReminders())
  }

  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceSupabaseClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('companion_vibe, notifications_enabled, planning_amount, primary_currency')
    .eq('id', user.id)
    .single()

  if (body?.preview) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .eq('user_id', user.id)

    const copy = await buildMorningCopyForUser(supabase, user.id, profile)
    if (!subs?.length) {
      return NextResponse.json({
        ok: true,
        localOnly: true,
        title: copy.title,
        body: copy.body,
        message: 'No push subscription yet — use local preview.',
      })
    }

    let sent = 0
    for (const sub of subs) {
      const result = await sendPushToSubscription(sub, {
        title: copy.title,
        body: copy.body,
        url: '/home',
      })
      if (result.ok) sent += 1
    }
    return NextResponse.json({ ok: true, sent, title: copy.title, body: copy.body })
  }

  if (!profile?.notifications_enabled) {
    return NextResponse.json({ error: 'Notifications are disabled' }, { status: 400 })
  }

  const copy = await buildMorningCopyForUser(supabase, user.id, profile)
  const result = await sendPushToUser(user.id, {
    title: copy.title,
    body: copy.body,
    url: '/home',
  })
  return NextResponse.json({ ok: true, ...result, title: copy.title, body: copy.body })
}

async function buildMorningCopyForUser(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  userId: string,
  profile: {
    planning_amount?: number | null
    primary_currency?: string | null
    companion_vibe?: string | null
  } | null
) {
  const today = todayInSingapore()
  const yesterday = addDaysToDateString(today, -1)
  const currency = getProfileDisplayCurrency({
    primary_currency: profile?.primary_currency || 'SGD',
  })

  const [{ data: fixed }, { data: recentEntries }] = await Promise.all([
    supabase
      .from('fixed_spending')
      .select('amount, is_active')
      .eq('user_id', userId)
      .eq('is_active', true),
    supabase
      .from('budget_entries')
      .select('amount, entry_date, category')
      .eq('user_id', userId)
      .gte('entry_date', yesterday)
      .lte('entry_date', today),
  ])

  const snapshot = getDailyBudgetSnapshot({
    planningAmount: profile?.planning_amount,
    todaySpent: 0,
    fixedSpending: fixed || [],
    subtractFixed: true,
  })

  const yesterdayTop = topSpendCategoryForDate(recentEntries || [], yesterday)

  if (snapshot.hasBudget) {
    return getMorningSafeCopy({
      safeToday: Math.max(0, snapshot.remaining),
      currency,
      yesterdayTop,
    })
  }

  // No planning amount — fall back to classic log reminder
  return getReminderCopy(profile?.companion_vibe)
}

async function runMorningSafeReminders() {
  const supabase = createServiceSupabaseClient()

  const nowParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const hour = nowParts.find((p) => p.type === 'hour')?.value || '08'
  const minute = nowParts.find((p) => p.type === 'minute')?.value || '00'
  const currentHm = `${hour}:${minute}`

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, companion_vibe, notification_time, notifications_enabled, planning_amount, primary_currency')
    .eq('notifications_enabled', true)

  if (error) {
    console.error('morning reminders query failed:', error.message)
    return { ok: false, error: error.message, sent: 0 }
  }

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const profile of profiles || []) {
    const time = String(profile.notification_time || '08:00:00').slice(0, 5)
    if (time !== currentHm) {
      skipped += 1
      continue
    }

    const copy = await buildMorningCopyForUser(supabase, profile.id, profile)
    const result = await sendPushToUser(profile.id, {
      title: copy.title,
      body: copy.body,
      url: '/home',
    })
    sent += result.sent
    failed += result.failed
    if (result.sent === 0 && result.failed === 0) skipped += 1
  }

  return { ok: true, currentHm, sent, failed, skipped }
}
