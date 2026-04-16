/* Renmito Service Worker — handles Web Push notifications */
'use strict';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  console.log('[sw] push event received', event.data?.text());

  let data = { title: 'Renmito', body: 'Time to log', url: '/' };
  try { data = Object.assign(data, event.data?.json()); } catch (_) {}

  const options = {
    body:     data.body,
    tag:      'renmito-checkin',
    renotify: true,
    data:     { url: data.url || '/' }
  };

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // Show notification regardless of whether the app window is focused
        console.log('[sw] active clients:', clients.length, '| showing notification');
        return self.registration.showNotification(data.title, options);
      })
      .then(() => console.log('[sw] notification shown'))
      .catch(err => console.error('[sw] showNotification failed:', err))
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
