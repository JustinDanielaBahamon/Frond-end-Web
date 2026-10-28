/* AlertaMujer browser notifications (Firebase Cloud Messaging).
 * With the tab closed (and the browser open), shows a contact's emergency alert and opens its
 * tracking page when tapped. The Firebase data is the public data of the web app. */
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAbsx-T3GLgE3w1YIN-1AiUslK2oOUkBmM',
  authDomain: 'alerta-mujer-b4fae.firebaseapp.com',
  projectId: 'alerta-mujer-b4fae',
  messagingSenderId: '656563018279',
  appId: '1:656563018279:web:b60ad55bf3f52ad1c30c02',
});

const messaging = firebase.messaging();

// The backend sends data-only messages (keys in Spanish): this decides what to show
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  const name = d.nombre || 'Un contacto';
  if (d.tipo === 'ALERTA_SOS') {
    return self.registration.showNotification('🚨 ' + name + ' activó una alerta de emergencia', {
      body: 'Toca para ver dónde está y cómo ayudar.',
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'alerta-' + (d.alertaId || ''),
      requireInteraction: true,
      data: { url: d.codigo ? '/seguimiento/' + d.codigo : '/dashboard/alertas-contactos' },
    });
  }
  if (d.tipo === 'ALERTA_FINALIZADA') {
    return self.registration.showNotification(name + ' está bien', {
      body: 'La alerta de emergencia terminó.',
      icon: '/logo.png',
      tag: 'alerta-' + (d.alertaId || ''),
      data: { url: '/dashboard/alertas-contactos' },
    });
  }
  // Others (e.g. PEDIR_UBICACION) are for the phone: ignored
  return undefined;
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard/alertas-contactos';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if ('focus' in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
