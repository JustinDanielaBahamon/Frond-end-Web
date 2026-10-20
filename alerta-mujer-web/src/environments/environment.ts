// Desarrollo local (`ng serve`). En producción Angular lo reemplaza por
// environment.prod.ts (ver fileReplacements en angular.json).
// apiUrl es solo el dominio del backend: los servicios ya agregan "/api/...".
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080',
  // Microservicios: dirección de Alert y Evidence (vacía = todo va a apiUrl, que es Auth).
  // Ver core/api/servicios.ts para saber qué rutas atiende cada uno.
  alertApiUrl: '',
  evidenceApiUrl: '',
  // Firebase (inicio de sesión con Google). Datos públicos de la "app web" del proyecto
  // en Firebase Console -> Configuración del proyecto -> Tus apps. No son secretos.
  firebase: {
    apiKey: 'AIzaSyAbsx-T3GLgE3w1YIN-1AiUslK2oOUkBmM',
    authDomain: 'alerta-mujer-b4fae.firebaseapp.com',
    projectId: 'alerta-mujer-b4fae',
    appId: '1:656563018279:web:b60ad55bf3f52ad1c30c02',
    messagingSenderId: '656563018279',
  },
  // Notificaciones del navegador: clave pública VAPID (Firebase Console -> Cloud Messaging ->
  // Certificados push web). No es secreta. Vacía = sin notificaciones con la pestaña cerrada.
  webPushVapidKey: 'BLSiU9gEWnISkoKuhb8fFlSfT8G6PVmezlBWl9s6KHI6Dor7DmyFXuyNibpXOYmXUShIDId_8AxmEr_Fz4ANc6w',
};
