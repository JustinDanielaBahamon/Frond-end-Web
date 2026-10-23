// Producción. Se usa al compilar con `ng build` (configuración "production"),
// gracias a fileReplacements en angular.json.
// apiUrl es solo el dominio del backend: los servicios ya agregan "/api/...".
// Microservicios en Azure Container Apps (entorno alertamujer-env, Brazil South).
export const environment = {
  production: true,
  // Auth Service (también atiende todo lo que no es de Alert ni de Evidence)
  apiUrl: 'https://alerta-mujer-auth.wittybush-c3d970eb.brazilsouth.azurecontainerapps.io',
  // Microservicios: dirección de Alert y Evidence (vacía = todo va a apiUrl, que es Auth).
  // Ver core/api/servicios.ts para saber qué rutas atiende cada uno.
  alertApiUrl: 'https://alerta-mujer-alert.wittybush-c3d970eb.brazilsouth.azurecontainerapps.io',
  evidenceApiUrl: 'https://alerta-mujer-evidence.wittybush-c3d970eb.brazilsouth.azurecontainerapps.io',
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
