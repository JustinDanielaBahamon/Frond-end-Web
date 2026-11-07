# Alerta Mujer — Plataforma web

## Resumen

**Alerta Mujer** es un sistema de seguridad personal para mujeres. Permite activar una alerta de
emergencia desde la aplicación móvil, registrar la ubicación durante la alerta, gestionar contactos
de emergencia, consultar zonas seguras y de riesgo, y guardar evidencias asociadas a cada alerta.

El sistema tiene tres componentes:

- **Aplicación móvil** (React Native con Expo, Android): canal principal de la usuaria.
- **Plataforma web** (Angular): portal de la usuaria y panel de administración. Es el contenido de este repositorio, en [`alerta-mujer-web/`](alerta-mujer-web/README.md).
- **Backend** (Java 17, Spring Boot 3.2, PostgreSQL 16): tres microservicios (Auth, Alert y Evidence).

## URL en producción

| Componente | Dirección |
|---|---|
| Plataforma web | https://alerta-mujer.vercel.app |
| Auth Service | https://alerta-mujer-auth.onrender.com |
| Alert Service | https://alerta-mujer-alert.onrender.com |
| Evidence Service | https://alerta-mujer-evidence.onrender.com |

La aplicación móvil se distribuye como APK de Android generado con EAS (Expo Application Services).

## Repositorios del proyecto

| Repositorio | Contenido |
|---|---|
| [AlertaMujer](https://github.com/JustinDanielaBahamon/AlertaMujer) | Aplicación móvil |
| [Frond-end-Web](https://github.com/JustinDanielaBahamon/Frond-end-Web) | Plataforma web |
| [Backend-ALERTA-MUJER](https://github.com/JustinDanielaBahamon/Backend-ALERTA-MUJER) | Backend |
| [wal-docs](https://github.com/code-sena/wal-docs) | Documentación del proyecto |

## Instalación y ejecución

Las instrucciones de instalación, pruebas y compilación de la plataforma web están en
[`alerta-mujer-web/README.md`](alerta-mujer-web/README.md).
