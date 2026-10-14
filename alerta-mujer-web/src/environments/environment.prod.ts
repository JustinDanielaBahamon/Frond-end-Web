// Producción. Se usa al compilar con `ng build` (configuración "production"),
// gracias a fileReplacements en angular.json.
// apiUrl es solo el dominio del backend: los servicios ya agregan "/api/...".
// Actualizar cuando el backend esté desplegado en Render.
export const environment = {
  production: true,
  apiUrl: 'https://alerta-mujer-backend.onrender.com',
  // Firebase (inicio de sesión con Google). Datos públicos de la "app web" del proyecto
  // en Firebase Console -> Configuración del proyecto -> Tus apps. No son secretos.
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    appId: '',
  },
};
