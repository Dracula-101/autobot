/* Autobot service worker — offline app shell + push notifications. */

const CACHE = 'autobot-v2'
const SCOPE = self.registration.scope

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(SCOPE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Only our own files. Supabase, Gemini, fonts and weather go straight to the network.
  if (url.origin !== self.location.origin || !req.url.startsWith(SCOPE)) return

  if (req.mode === 'navigate') {
    // Network first so updates land immediately; the cached shell covers offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            void caches.open(CACHE).then((c) => c.put(SCOPE, copy))
          }
          return res
        })
        .catch(() => caches.match(SCOPE)),
    )
    return
  }

  if (url.pathname.includes('/assets/') || url.pathname.includes('/icons/')) {
    // Hashed build files never change: cache first.
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              void caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Autobot', body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Autobot', {
      body: data.body || '',
      icon: `${SCOPE}icons/icon-192.png`,
      badge: `${SCOPE}icons/badge-96.png`,
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = String(event.notification.data?.url || '/').replace(/^\//, '')
  const target = new URL(path, SCOPE).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (client.url.startsWith(SCOPE)) {
          await client.focus()
          if ('navigate' in client) await client.navigate(target)
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
