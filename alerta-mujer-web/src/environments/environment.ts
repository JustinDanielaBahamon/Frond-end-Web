// Local development (`ng serve`). In production Angular replaces it with
// environment.prod.ts (ver fileReplacements en angular.json).
// apiUrl is only the backend domain: the services already add "/api/...".
export const environment = {
  production: false,
  // MICROSERVICES IN PRODUCTION (to test locally against production)
  apiUrl: 'https://alerta-mujer-auth.onrender.com',
  alertApiUrl: 'https://alerta-mujer-alert.onrender.com',
  evidenceApiUrl: 'https://alerta-mujer-evidence.onrender.com',
  
  // LOCAL DEVELOPMENT (comment the lines above and uncomment these to use localhost)
  // apiUrl: 'http://localhost:8080',
  // alertApiUrl: '',
  // evidenceApiUrl: '',
  
  // Firebase (Google sign-in). Public data of the project "web app"
  // in Firebase Console -> Project settings -> Your apps. They are not secrets.
  firebase: {
    apiKey: 'AIzaSyAbsx-T3GLgE3w1YIN-1AiUslK2oOUkBmM',
    authDomain: 'alerta-mujer-b4fae.firebaseapp.com',
    projectId: 'alerta-mujer-b4fae',
    appId: '1:656563018279:web:b60ad55bf3f52ad1c30c02',
    messagingSenderId: '656563018279',
  },
  // Browser notifications: public VAPID key (Firebase Console -> Cloud Messaging ->
  // Web push certificates). It is not secret. Empty = no notifications with the tab closed.
  webPushVapidKey: 'BLSiU9gEWnISkoKuhb8fFlSfT8G6PVmezlBWl9s6KHI6Dor7DmyFXuyNibpXOYmXUShIDId_8AxmEr_Fz4ANc6w',
};
