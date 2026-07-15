import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { createServiceSupabaseClient } from '@/lib/supabase-admin'
import { sendReminderToUser, sendPushToSubscription } from '@/lib/notifications/web-push'
import { getReminderCopy } from '@/lib/notifications/copy'
import { todayInSingapore } from '@/lib/sarathy/sgt'

/**
 * POST /api/send-notification
 * - Authenticated user + { preview: true } → send reminder to self
 * - Cron/admin with Authorization: Bearer CRON_SECRET → fan-out daily reminders
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
    return NextResponse.json(await runDailyReminders())
  }

  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceSupabaseClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('companion_vibe, notifications_enabled')
    .eq('id', user.id)
    .single()

  if (body?.preview) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .eq('user_id', user.id)

    const copy = getReminderCopy(profile?.companion_vibe)
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
      })
      if (result.ok) sent += 1
    }
    return NextResponse.json({ ok: true, sent, title: copy.title, body: copy.body })
  }

  if (!profile?.notifications_enabled) {
    return NextResponse.json({ error: 'Notifications are disabled' }, { status: 400 })
  }

  const result = await sendReminderToUser(user.id, profile.companion_vibe)
  return NextResponse.json({ ok: true, ...result })
}

async function runDailyReminders() {
  const supabase = createServiceSupabaseClient()
  const today = todayInSingapore()

  // Current HH:MM in Asia/Singapore
  const nowParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const hour = nowParts.find((p) => p.type === 'hour')?.value || '20'
  const minute = nowParts.find((p) => p.type === 'minute')?.value || '00'
  const currentHm = `${hour}:${minute}`

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, companion_vibe, notification_time, notifications_enabled')
    .eq('notifications_enabled', true)

  if (error) {
    console.error('daily reminders query failed:', error.message)
    return { ok: false, error: error.message, sent: 0 }
  }

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const profile of profiles || []) {
    const time = String(profile.notification_time || '20:00:00').slice(0, 5)
    // Match within the same minute window the cron hits
    if (time !== currentHm) {
      skipped += 1
      continue
    }

    // Skip if they already logged something today
    const { count } = await supabase
      .from('budget_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('entry_date', today)

    if ((count ?? 0) > 0) {
      skipped += 1
      continue
    }

    const result = await sendReminderToUser(profile.id, profile.companion_vibe)
    sent += result.sent
    failed += result.failed
  }

  return { ok: true, currentHm, sent, failed, skipped }
}
