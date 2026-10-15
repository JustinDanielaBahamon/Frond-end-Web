// Desarrollo local (`ng serve`). En producción Angular lo reemplaza por
// environment.prod.ts (ver fileReplacements en angular.json).
// apiUrl es solo el dominio del backend: los servicios ya agregan "/api/...".
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080',
  // Firebase (inicio de sesión con Google). Datos públicos de la "app web" del proyecto
  // en Firebase Console -> Configuración del proyecto -> Tus apps. No son secretos.
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    appId: '',
  },
};
