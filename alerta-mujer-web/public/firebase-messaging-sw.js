/* Notificaciones del navegador de AlertaMujer (Firebase Cloud Messaging).
 * Con la pestaña cerrada (y el navegador abierto), muestra la alerta de emergencia de un contacto
 * y al tocarla abre su seguimiento. Los datos de Firebase son los públicos de la app web. */
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

// El backend envía mensajes solo de datos: aquí se decide qué mostrar
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  const nombre = d.nombre || 'Un contacto';
  if (d.tipo === 'ALERTA_SOS') {
    return self.registration.showNotification('🚨 ' + nombre + ' activó una alerta de emergencia', {
      body: 'Toca para ver dónde está y cómo ayudar.',
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'alerta-' + (d.alertaId || ''),
      requireInteraction: true,
      data: { url: d.codigo ? '/seguimiento/' + d.codigo : '/dashboard/alertas-contactos' },
    });
  }
  if (d.tipo === 'ALERTA_FINALIZADA') {
    return self.registration.showNotification(nombre + ' está bien', {
      body: 'La alerta de emergencia terminó.',
      icon: '/logo.png',
      tag: 'alerta-' + (d.alertaId || ''),
      data: { url: '/dashboard/alertas-contactos' },
    });
  }
  // Otros (p. ej. PEDIR_UBICACION) son para el celular: se ignoran
  return undefined;
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard/alertas-contactos';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if ('focus' in v) {
          v.navigate(url);
          return v.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
