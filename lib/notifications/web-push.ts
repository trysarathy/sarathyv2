import webpush from 'web-push'
import { createServiceSupabaseClient } from '@/lib/supabase-admin'
import {
  getReminderCopy,
  LOG_EXPENSE_DEEP_LINK,
  type CompanionTone,
} from '@/lib/notifications/copy'

export type PushSubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:hello@trysarathy.com'
  if (!publicKey || !privateKey) {
    throw new Error('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY')
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
}

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null
}

export async function sendPushToSubscription(
  sub: Pick<PushSubscriptionRow, 'endpoint' | 'p256dh' | 'auth' | 'id'>,
  payload: { title: string; body: string; url?: string }
): Promise<{ ok: boolean; gone?: boolean; error?: string }> {
  configureWebPush()
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || LOG_EXPENSE_DEEP_LINK,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
      })
    )
    return { ok: true }
  } catch (err: unknown) {
    const status =
      err && typeof err === 'object' && 'statusCode' in err
        ? Number((err as { statusCode: number }).statusCode)
        : 0
    if (status === 404 || status === 410) {
      const supabase = createServiceSupabaseClient()
      await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      return { ok: false, gone: true, error: 'Subscription expired' }
    }
    const message = err instanceof Error ? err.message : 'Push failed'
    console.error('web-push error:', message)
    return { ok: false, error: message }
  }
}

export async function sendReminderToUser(
  userId: string,
  vibe: CompanionTone | string | null | undefined
): Promise<{ sent: number; failed: number }> {
  const supabase = createServiceSupabaseClient()
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error || !subs?.length) {
    return { sent: 0, failed: 0 }
  }

  const copy = getReminderCopy(vibe)
  let sent = 0
  let failed = 0
  for (const sub of subs as PushSubscriptionRow[]) {
    const result = await sendPushToSubscription(sub, {
      title: copy.title,
      body: copy.body,
      url: LOG_EXPENSE_DEEP_LINK,
    })
    if (result.ok) sent += 1
    else failed += 1
  }
  return { sent, failed }
}
