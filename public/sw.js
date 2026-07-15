/* Sarathy PWA service worker — Web Push + notification click → Log Expense */

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Sarathy',
    body: "Don't forget to log today's expenses.",
    url: '/home?log=expense',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  }

  try {
    if (event.data) {
      const data = event.data.json()
      payload = { ...payload, ...data }
    }
  } catch {
    try {
      const text = event.data && event.data.text()
      if (text) payload.body = text
    } catch {
      /* keep defaults */
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      data: { url: payload.url || '/home?log=expense' },
      vibrate: [80, 40, 80],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/home?log=expense'
  const absolute = new URL(targetUrl, self.location.origin).href

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            await client.navigate(absolute)
            return
          }
          // Same-origin client without navigate — postMessage fallback
          client.postMessage({ type: 'SARATHY_OPEN_LOG_EXPENSE' })
          return
        }
      }
      await self.clients.openWindow(absolute)
    })()
  )
})
