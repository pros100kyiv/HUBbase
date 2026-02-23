/* eslint-disable no-restricted-globals */
/* Мінімальний service worker тільки для push-сповіщень (без precache) */

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Xbase', body: event.data ? String(event.data.text()) : '' }
  }

  const title = data.title || 'Xbase'
  const targetUrl = data.url || (self.location ? self.location.origin + '/' : '/')
  const iconUrl = data.icon || (self.location ? self.location.origin + '/icon.png' : '/icon.png')
  const badgeUrl = data.badge || (self.location ? self.location.origin + '/icon.png' : '/icon.png')
  const options = {
    body: data.body || '',
    icon: iconUrl,
    badge: badgeUrl,
    tag: data.tag || 'xbase-notification',
    vibrate: data.vibrate || [200, 100, 200],
    data: { url: targetUrl },
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification?.data?.url || '/'
  const fullUrl = targetUrl.startsWith('http') ? targetUrl : (self.location ? self.location.origin + (targetUrl.startsWith('/') ? '' : '/') + targetUrl : targetUrl)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url)
          const targetUrlObj = new URL(fullUrl)
          if (clientUrl.origin === targetUrlObj.origin && (clientUrl.pathname === targetUrlObj.pathname || clientUrl.pathname.startsWith(targetUrlObj.pathname + '/'))) {
            if (typeof client.focus === 'function') return client.focus()
          }
        } catch (e) {}
      }
      if (self.clients.openWindow) return self.clients.openWindow(fullUrl)
      return null
    })
  )
})
