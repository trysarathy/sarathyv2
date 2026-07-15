'use client'

import { getAuthHeaders } from '@/lib/api-auth'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function registerSarathyServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch (err) {
    console.error('SW register failed:', err)
    return null
  }
}

export async function subscribeToPush(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (!isPushSupported()) {
    return { ok: false, error: 'Push notifications are not supported in this browser.' }
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) {
    return { ok: false, error: 'Push is not configured yet (missing VAPID public key).' }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { ok: false, error: 'Notification permission was not granted.' }
  }

  const registration =
    (await navigator.serviceWorker.getRegistration()) ||
    (await registerSarathyServiceWorker())
  if (!registration) {
    return { ok: false, error: 'Could not register the notification service worker.' }
  }

  await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    })
  }

  const json = subscription.toJSON()
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      ...(await getAuthHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
    }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: data.error || 'Could not save push subscription.' }
  }

  return { ok: true }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) {
    const endpoint = subscription.endpoint
    await subscription.unsubscribe().catch(() => undefined)
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: {
        ...(await getAuthHeaders()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endpoint }),
    }).catch(() => undefined)
  }
}

/** Local preview (does not use the server). Falls back to in-app if permission denied. */
export function showLocalNotificationPreview(title: string, body: string): boolean {
  if (!isPushSupported()) return false
  if (Notification.permission !== 'granted') return false
  try {
    // Prefer SW notification when available so it matches production UX
    void navigator.serviceWorker.ready.then((reg) => {
      void reg.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: '/home?log=expense' },
      })
    })
    return true
  } catch {
    return false
  }
}
