// Service Worker: zeigt Mitteilungen vom Partner, solange das Spiel nicht offen im Vordergrund ist.
self.addEventListener('push', (event) => {
  let data = { title: 'Hundespiel', body: 'Bei euren Hunden ist etwas passiert' }
  try { data = { ...data, ...event.data.json() } } catch { /* Standardtext */ }
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (wins.some((w) => w.visibilityState === 'visible')) return
    await self.registration.showNotification(data.title, { body: data.body, icon: './icon-192.png', badge: './icon-192.png', tag: 'hundespiel' })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (wins.length > 0) { await wins[0].focus(); return }
    await self.clients.openWindow('./')
  })())
})
