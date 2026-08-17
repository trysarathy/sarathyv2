/* Sarathy PWA service worker — offline shell + Web Push + share_target */

const CACHE_NAME = 'sarathy-v2'
const SHARE_CACHE = 'sarathy-share-v1'
const SHARE_FILE_KEY = '/__share_file'
const STATIC_ASSETS = [
  '/',
  '/home',
  '/share',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] cache skip', url, err)
          })
        )
      )
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== SHARE_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

/** Web Share Target — POST /share → stash file, redirect GET /share?... */
async function handleShareTarget(request) {
  const formData = await request.formData()
  const title = formData.get('title')
  const text = formData.get('text')
  const sharedUrl = formData.get('url')
  const file = formData.get('file')

  const cache = await caches.open(SHARE_CACHE)
  await cache.delete(SHARE_FILE_KEY)

  let hasFile = false
  if (file && typeof file === 'object' && 'arrayBuffer' in file && file.size > 0) {
    const headers = new Headers({
      'Content-Type': file.type || 'application/octet-stream',
      'X-Filename': file.name || 'share.jpg',
    })
    await cache.put(SHARE_FILE_KEY, new Response(file, { headers }))
    hasFile = true
  }

  const params = new URLSearchParams()
  if (typeof title === 'string' && title.trim()) params.set('title', title.trim())
  if (typeof text === 'string' && text.trim()) params.set('text', text.trim())
  if (typeof sharedUrl === 'string' && sharedUrl.trim()) params.set('url', sharedUrl.trim())
  if (hasFile) params.set('hasFile', '1')

  const redirectTo = new URL('/share', self.location.origin)
  redirectTo.search = params.toString()
  return Response.redirect(redirectTo.href, 303)
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  if (
    event.request.method === 'POST' &&
    url.origin === self.location.origin &&
    url.pathname === '/share'
  ) {
    event.respondWith(handleShareTarget(event.request))
    return
  }

  if (event.request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Sarathy',
    body: "Don't forget to log today's expenses.",
    url: '/home?log=expense',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
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
          client.postMessage({ type: 'SARATHY_OPEN_LOG_EXPENSE' })
          return
        }
      }
      await self.clients.openWindow(absolute)
    })()
  )
})
