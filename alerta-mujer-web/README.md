# Alerta Mujer — Frontend web

Panel web de **Alerta Mujer**, una aplicación de seguridad personal para mujeres. Tiene dos zonas:

- **Usuaria**: inicio, mis emergencias, ubicación (mi ubicación en vivo, ubicaciones guardadas, zonas auxiliares, recorridos), evidencias, contactos de emergencia, asistencia, dispositivo y configuración.
- **Administración**: usuarias, alertas, zonas, evidencias, dispositivos, reportes y moderación.

La app móvil (Expo) y esta web comparten el mismo backend (Spring Boot + PostgreSQL), por lo que los datos están sincronizados entre ambas.

## Tecnologías

| Componente | Versión |
|---|---|
| Angular (componentes standalone, signals) | 21.2 |
| TypeScript | 5.9 |
| RxJS | 7.8 |
| Bootstrap | 5.3 |
| Leaflet (mapas, teselas de OpenStreetMap) | 1.9 |
| Vitest + jsdom (pruebas unitarias) | 4.1 |

## Requisitos

- Node.js 20 o superior y npm.
- El backend corriendo (por defecto en `http://localhost:8080`). Ver el repositorio `Backend-ALERTA-MUJER`.

## Instalación y ejecución

```bash
npm install
npm start            # ng serve -> http://localhost:4200
```

## Configuración del backend

La URL del backend se define en `src/environments/`:

| Archivo | Se usa con | `apiUrl` |
|---|---|---|
| `environment.ts` | `ng serve` y `ng build --configuration development` | `http://localhost:8080` |
| `environment.prod.ts` | `ng build` (producción) | dominio del backend desplegado |

`apiUrl` es **solo el dominio**: los servicios agregan `/api/...` por su cuenta. Angular reemplaza un archivo por el otro gracias a `fileReplacements` en `angular.json`.

## Compilación

```bash
npm run build        # producción -> dist/alerta-mujer-web/browser
```

Despliegue previsto: **Vercel** (frontend) apuntando al backend en **Render**. Al desplegar, actualiza `apiUrl` en `environment.prod.ts` y agrega el dominio de Vercel a `CORS_ORIGIN` en el backend. Como es una SPA, configura en Vercel que todas las rutas sirvan `index.html`.

## Pruebas

```bash
npm test             # ng test (Vitest)
```

## Estructura

```
src/app/
├── core/       # servicios HTTP, modelos, guards (auth/usuaria/admin), interceptor JWT, layouts, tema
├── features/   # pantallas por funcionalidad: auth, landing, dashboard (usuaria), admin
└── shared/     # componentes reutilizables, estilos y temas (claro/oscuro)
```

## Autenticación

El login guarda el token JWT y el interceptor `core/interceptors/jwt.interceptor.ts` lo envía en cada petición (`Authorization: Bearer ...`). Las rutas de la usuaria y del administrador están protegidas por los guards de `core/guards/role.guard.ts`.
