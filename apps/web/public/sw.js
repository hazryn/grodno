/* Service worker Rodno — web push czatu. Notyfikacja tylko gdy żadna karta nie jest aktywna;
   klik → fokus istniejącej karty (+ przekazanie conversationId) albo otwarcie nowej. */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_e) {
    payload = {};
  }
  const title = payload.title || 'Rodno';
  const body = payload.body || '';
  const conversationId = payload.conversationId || null;
  const url = payload.url || '/';

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const focused = clientList.some((c) => c.focused || c.visibilityState === 'visible');
      if (focused) return; // aplikacja otwarta i widoczna — pokaże w UI, nie dublujemy
      await self.registration.showNotification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: conversationId || 'rodno-chat',
        data: { conversationId, url },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus();
          if (data.conversationId) client.postMessage({ openConversation: data.conversationId });
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(data.url || '/');
    })(),
  );
});
