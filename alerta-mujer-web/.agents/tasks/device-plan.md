# Plan de Implementación: Pantalla Estado del Dispositivo

## Contexto del Proyecto

- **Framework**: Angular 18+ standalone components
- **Lenguaje**: TypeScript 5.9.2
- **Estilo**: SCSS con variables CSS locales
- **Iconos**: Tabler Icons (clases `ti ti-*`)
- **Mapa**: Leaflet 1.9.4
- **Build**: `ng build` / `ng serve`
- **Test**: `ng test` (Vitest)
- **Patrón de servicios**: Injectable con `providedIn: 'root'`, usa `inject()`, HttpClient para API REST
- **Patrón de componentes**: Standalone, señales de Angular (`signal`, `computed`), imports explícitos (CommonModule, RouterLink, etc.)
- **Patrón de estilos**: Variables CSS en `:host` (--color-principal, --color-acento, --color-exito, --color-advertencia, --color-peligro, --color-superficie, --color-fondo, --color-borde, etc.), clases BEM-like reutilizables

## Decisiones de Diseño

### 1. Arquitectura de la Pantalla

La pantalla "Estado del Dispositivo" tendrá **8 secciones** organizadas verticalmente en un layout responsive:

1. **Encabezado**: título + último refresh
2. **Permisos del Navegador**: geolocalización, notificaciones, cámara, micrófono, portapapeles
3. **Estado de Servicios**: GPS, conectividad (online/offline), calidad de conexión
4. **Información del Dispositivo**: navegador, versión, SO, idioma, zona horaria, resolución de pantalla
5. **Estado de Funcionalidades Críticas**: sesión activa, última ubicación capturada, token de notificaciones push, contactos de emergencia configurados
6. **Registro de Actividad**: últimas 5 acciones (alertas enviadas, ubicaciones capturadas, errores)
7. **Pruebas de Funcionalidad**: botones para probar geolocalización, notificaciones, conectividad
8. **Acciones Rápidas**: sincronizar datos, limpiar caché local, exportar diagnóstico JSON, refrescar permisos

**Justificación**: Esta estructura replica el flujo informativo de apps nativas de diagnóstico y permite a la usuaria validar cada capa del sistema (permisos → servicios → configuración → funcionalidad → histórico → pruebas → acciones correctivas).

### 2. Servicios y APIs del Navegador

Crearemos **dos servicios nuevos**:

- **DeviceInfoService**: encapsula todas las APIs del navegador (Navigator, Geolocation, Permissions, Notification, Screen, NetworkInformation). Métodos síncronos para info estática (navegador, SO, resolución) y observables para info reactiva (posición GPS, estado de permisos, online/offline).
  
- **PermissionsService**: especializado en verificar y solicitar permisos (geolocation, notifications, camera, microphone, clipboard-read). Devuelve observables de estado actual (`'granted'`, `'denied'`, `'prompt'`) y tiene métodos para solicitar permisos.

**Justificación**: Separar la lógica de acceso a APIs del navegador del componente cumple con separación de responsabilidades, facilita pruebas unitarias (se pueden mockear los servicios), y permite reutilizar la lógica en otros componentes (ej: el módulo de ubicación puede usar PermissionsService para validar GPS antes de mostrar el mapa).

### 3. Manejo de APIs No Disponibles

Cada método en `DeviceInfoService` y `PermissionsService` verificará la existencia de la API antes de usarla:

```typescript
if ('geolocation' in navigator) { /* usar */ }
else { return of({ error: 'API no disponible' }); }
```

La UI mostrará badges neutrales ("No disponible" en gris) cuando una API no exista o devuelva error, sin romper la pantalla.

**Justificación**: La aplicación web puede ejecutarse en navegadores variados (Chrome, Firefox, Safari móvil, etc.) con diferentes niveles de soporte para APIs modernas. Fallar de forma silenciosa y mostrar un estado "no disponible" garantiza que la pantalla siempre sea usable.

### 4. Patrón de Estilos

Reutilizaremos el patrón visual de `home.scss` y `nearby-zones.scss`:

- **Variables CSS** en `:host` para colores y tamaños
- **Clases de card** tipo `.device-panel` (equivalente a `.home-panel`)
- **Badges** tipo `.device-badge` con variantes `--exito`, `--advertencia`, `--peligro`, `--neutral`
- **Grid responsivo** para secciones (1 columna en móvil, 2-3 columnas en desktop)
- **Iconos Tabler** en círculos de color semántico (verde para OK, rojo para error, amarillo para advertencia, gris para no disponible)

**Justificación**: Mantener consistencia visual con el resto de la aplicación reduce la carga cognitiva de la usuaria y facilita mantenimiento futuro. El patrón ya está probado en `home` y `nearby-zones`.

### 5. Registro de Actividad

El "Registro de Actividad" obtendrá las últimas 5 entradas del localStorage (clave `device-activity-log`, array de objetos `{ timestamp, type, message }`). Si no existe, mostrará "Sin actividad reciente".

**Justificación**: No existe un endpoint backend específico para logs del cliente. Usar localStorage permite registrar eventos del lado del navegador (errores de GPS, notificaciones enviadas, etc.) sin sobrecarga de red. 5 entradas son suficientes para diagnóstico rápido sin saturar la UI.

### 6. Pruebas de Funcionalidad

Cada botón de prueba ejecutará la acción real y mostrará un toast/alert con el resultado:

- **Probar Geolocalización**: llama a `navigator.geolocation.getCurrentPosition()` y muestra lat/lng en un alert
- **Probar Notificaciones**: solicita permiso (si no está granted) y envía una notificación de prueba
- **Probar Conectividad**: hace un `fetch()` al endpoint `/api/health` del backend y muestra el tiempo de respuesta

**Justificación**: Las usuarias necesitan verificar que las funcionalidades críticas funcionan en su navegador específico. Hacer la prueba real (no simulada) da confianza.

### 7. Acciones Rápidas

- **Sincronizar datos**: hace peticiones GET a los endpoints principales (contactos, zonas, recorridos) y muestra un resumen "X items sincronizados"
- **Limpiar caché**: borra claves específicas del localStorage (no session, no auth)
- **Exportar diagnóstico**: genera un JSON con toda la info de la pantalla y lo descarga como `diagnostico-alerta-mujer-{timestamp}.json`
- **Refrescar permisos**: vuelve a consultar el estado de cada permiso y actualiza la UI

**Justificación**: Dar a la usuaria herramientas de autoservicio reduce tickets de soporte. Exportar diagnóstico permite que la usuaria comparta un snapshot técnico completo con soporte técnico.

---

## Plan de Implementación Detallado

### ✅ **Paso 1: Crear el modelo de datos para Device Info**

Crear la interfaz TypeScript que define la estructura de información del dispositivo.

**Archivos a crear/modificar**:
- `src/app/core/models/device-info.model.ts` (crear)

**Contenido del modelo**:

```typescript
export interface PermissionStatus {
  name: string;
  state: 'granted' | 'denied' | 'prompt' | 'unavailable';
  canRequest: boolean;
}

export interface ServiceStatus {
  name: string;
  enabled: boolean;
  details?: string;
}

export interface DeviceInfo {
  browser: string;
  version: string;
  os: string;
  language: string;
  timezone: string;
  screenResolution: string;
  userAgent: string;
}

export interface ActivityLog {
  timestamp: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

export interface CriticalFeatureStatus {
  sessionActive: boolean;
  lastLocationCaptured: string | null;
  notificationToken: string | null;
  emergencyContactsCount: number;
}
```

**Verificación**: `ng build` debe compilar sin errores. El modelo debe ser importable desde el componente.

---

### ✅ **Paso 2: Implementar DeviceInfoService**

Servicio que encapsula todas las consultas a APIs del navegador (Navigator, Screen, NetworkInformation, Storage).

**Archivos a crear/modificar**:
- `src/app/core/services/device-info.service.ts` (crear)

**Funcionalidades del servicio**:

- `getDeviceInfo(): DeviceInfo` - método síncrono que retorna info estática del navegador/dispositivo
- `isOnline(): Observable<boolean>` - observable que emite true/false según `navigator.onLine` y escucha eventos `online`/`offline`
- `getConnectionQuality(): string` - retorna calidad de conexión usando Network Information API (si disponible)
- `getScreenInfo(): { width, height, dpr }` - info de pantalla
- `getCurrentPosition(): Observable<GeolocationPosition | null>` - wrapper de Geolocation API que maneja errores

**Patrón de implementación**:

```typescript
@Injectable({ providedIn: 'root' })
export class DeviceInfoService {
  
  getDeviceInfo(): DeviceInfo {
    const ua = navigator.userAgent;
    return {
      browser: this.detectBrowser(ua),
      version: this.detectVersion(ua),
      os: this.detectOS(ua),
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenResolution: `${screen.width}x${screen.height}`,
      userAgent: ua
    };
  }

  isOnline(): Observable<boolean> {
    return new Observable(observer => {
      observer.next(navigator.onLine);
      const onlineHandler = () => observer.next(true);
      const offlineHandler = () => observer.next(false);
      window.addEventListener('online', onlineHandler);
      window.addEventListener('offline', offlineHandler);
      return () => {
        window.removeEventListener('online', onlineHandler);
        window.removeEventListener('offline', offlineHandler);
      };
    });
  }

  private detectBrowser(ua: string): string { /* lógica de detección */ }
  private detectOS(ua: string): string { /* lógica de detección */ }
  // ... otros métodos privados
}
```

**Verificación**: `ng test` debe pasar las pruebas unitarias básicas del servicio. El servicio debe ser inyectable en el componente Device.

---

### ✅ **Paso 3: Implementar PermissionsService**

Servicio especializado en verificar y solicitar permisos del navegador.

**Archivos a crear/modificar**:
- `src/app/core/services/permissions.service.ts` (crear)

**Funcionalidades del servicio**:

- `checkPermission(name: PermissionName): Observable<PermissionStatus>` - verifica estado actual de un permiso
- `requestGeolocation(): Observable<PermissionState>` - solicita permiso de ubicación
- `requestNotifications(): Observable<NotificationPermission>` - solicita permiso de notificaciones
- `checkAllPermissions(): Observable<PermissionStatus[]>` - verifica todos los permisos relevantes (geolocation, notifications, camera, microphone, clipboard-read)

**Patrón de implementación**:

```typescript
@Injectable({ providedIn: 'root' })
export class PermissionsService {

  checkPermission(name: PermissionName): Observable<PermissionStatus> {
    if (!('permissions' in navigator)) {
      return of({ name, state: 'unavailable', canRequest: false });
    }
    
    return from(navigator.permissions.query({ name })).pipe(
      map(result => ({ 
        name, 
        state: result.state, 
        canRequest: result.state === 'prompt' 
      })),
      catchError(() => of({ name, state: 'unavailable' as const, canRequest: false }))
    );
  }

  requestNotifications(): Observable<NotificationPermission> {
    if (!('Notification' in window)) {
      return of('denied' as NotificationPermission);
    }
    
    if (Notification.permission === 'granted') {
      return of('granted');
    }
    
    return from(Notification.requestPermission());
  }

  checkAllPermissions(): Observable<PermissionStatus[]> {
    const permissions: PermissionName[] = ['geolocation', 'notifications'];
    return forkJoin(permissions.map(p => this.checkPermission(p)));
  }
}
```

**Verificación**: `ng test` debe pasar. El servicio debe manejar correctamente el caso donde Permissions API no está disponible (Safari, navegadores antiguos).

---

### ✅ **Paso 4: Actualizar el componente Device (TypeScript)**

Modificar `device.ts` para integrar los servicios y gestionar el estado de la pantalla.

**Archivos a crear/modificar**:
- `src/app/features/dashboard/device/device.ts` (modificar)

**Estructura del componente**:

```typescript
@Component({
  selector: 'app-device',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './device.html',
  styleUrl: './device.scss',
})
export class Device implements OnInit, OnDestroy {
  private deviceInfoService = inject(DeviceInfoService);
  private permissionsService = inject(PermissionsService);
  private authService = inject(AuthService);
  
  // Estado reactivo con signals
  deviceInfo = signal<DeviceInfo | null>(null);
  permissions = signal<PermissionStatus[]>([]);
  services = signal<ServiceStatus[]>([]);
  isOnline = signal<boolean>(true);
  connectionQuality = signal<string>('Desconocida');
  criticalFeatures = signal<CriticalFeatureStatus | null>(null);
  activityLog = signal<ActivityLog[]>([]);
  
  lastRefresh = signal<string>('');
  loading = signal<boolean>(true);
  
  private destroy$ = new Subject<void>();
  
  ngOnInit(): void {
    this.loadDeviceInfo();
    this.loadPermissions();
    this.loadServices();
    this.loadCriticalFeatures();
    this.loadActivityLog();
    this.subscribeToOnlineStatus();
  }
  
  private loadDeviceInfo(): void {
    this.deviceInfo.set(this.deviceInfoService.getDeviceInfo());
  }
  
  private loadPermissions(): void {
    this.permissionsService.checkAllPermissions()
      .pipe(takeUntil(this.destroy$))
      .subscribe(perms => this.permissions.set(perms));
  }
  
  // Métodos para pruebas de funcionalidad
  testGeolocation(): void { /* implementación */ }
  testNotifications(): void { /* implementación */ }
  testConnectivity(): void { /* implementación */ }
  
  // Acciones rápidas
  syncData(): void { /* implementación */ }
  clearCache(): void { /* implementación */ }
  exportDiagnostic(): void { /* implementación */ }
  refreshPermissions(): void { /* implementación */ }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

**Verificación**: `ng build` debe compilar. El componente debe inyectar los servicios correctamente y cargar datos en `ngOnInit()`.

---

### ✅ **Paso 5: Crear la plantilla HTML del componente Device**

Diseñar la estructura HTML de la pantalla con las 8 secciones.

**Archivos a crear/modificar**:
- `src/app/features/dashboard/device/device.html` (modificar completamente)

**Estructura HTML**:

```html
<div class="device-wrap">
  
  <!-- 1. ENCABEZADO -->
  <div class="device-header">
    <h1 class="device-title">Estado del Dispositivo</h1>
    <p class="device-subtitle">Diagnóstico completo del sistema • Última actualización: {{ lastRefresh() }}</p>
    <button class="device-btn device-btn--icon" (click)="refreshAll()" title="Refrescar">
      <i class="ti ti-refresh"></i>
    </button>
  </div>

  <!-- 2. PERMISOS DEL NAVEGADOR -->
  <div class="device-panel">
    <h2 class="device-panel__title">
      <i class="ti ti-shield-check"></i> Permisos del Navegador
    </h2>
    <div class="device-grid device-grid--3col">
      @for (perm of permissions(); track perm.name) {
        <div class="device-item">
          <div class="device-item__icon" [ngClass]="'device-item__icon--' + getStatusColor(perm.state)">
            <i class="ti" [ngClass]="getIconForPermission(perm.name)"></i>
          </div>
          <p class="device-item__label">{{ perm.name }}</p>
          <span class="device-badge" [ngClass]="'device-badge--' + getStatusColor(perm.state)">
            {{ getStatusLabel(perm.state) }}
          </span>
        </div>
      }
    </div>
  </div>

  <!-- 3. ESTADO DE SERVICIOS -->
  <div class="device-panel">
    <h2 class="device-panel__title">
      <i class="ti ti-wifi"></i> Estado de Servicios
    </h2>
    <div class="device-list">
      @for (service of services(); track service.name) {
        <div class="device-list-item">
          <i class="ti" [ngClass]="service.enabled ? 'ti-check' : 'ti-x'"></i>
          <span class="device-list-item__label">{{ service.name }}</span>
          <span class="device-badge" [ngClass]="service.enabled ? 'device-badge--exito' : 'device-badge--peligro'">
            {{ service.enabled ? 'Activo' : 'Inactivo' }}
          </span>
        </div>
      }
    </div>
  </div>

  <!-- 4. INFORMACIÓN DEL DISPOSITIVO -->
  <div class="device-panel">
    <h2 class="device-panel__title">
      <i class="ti ti-device-desktop"></i> Información del Dispositivo
    </h2>
    @if (deviceInfo(); as info) {
      <div class="device-info-grid">
        <div class="device-info-item">
          <span class="device-info-item__label">Navegador</span>
          <span class="device-info-item__value">{{ info.browser }} {{ info.version }}</span>
        </div>
        <div class="device-info-item">
          <span class="device-info-item__label">Sistema Operativo</span>
          <span class="device-info-item__value">{{ info.os }}</span>
        </div>
        <!-- más campos... -->
      </div>
    }
  </div>

  <!-- 5. ESTADO DE FUNCIONALIDADES CRÍTICAS -->
  <!-- 6. REGISTRO DE ACTIVIDAD -->
  <!-- 7. PRUEBAS DE FUNCIONALIDAD -->
  <!-- 8. ACCIONES RÁPIDAS -->

</div>
```

**Verificación**: `ng serve` debe mostrar la pantalla sin errores de template. La estructura debe ser responsive y mostrar datos dummy iniciales.

---

### ✅ **Paso 6: Implementar los estilos SCSS del componente Device**

Crear los estilos siguiendo el patrón de `home.scss` y `nearby-zones.scss`.

**Archivos a crear/modificar**:
- `src/app/features/dashboard/device/device.scss` (modificar completamente)

**Estructura de estilos**:

```scss
:host {
  --color-principal: #6d28d9;
  --color-acento: #0891b2;
  --color-exito: #10b981;
  --color-advertencia: #d97706;
  --color-peligro: #ef4444;
  --color-neutral: #6b7280;
  --color-superficie: #ffffff;
  --color-fondo: #f5f3ff;
  --color-borde: #c4b5fd;
  --color-texto-principal: #2d1457;
  --color-texto-secundario: #8b7bac;

  display: block;
}

.device-wrap {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.device-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.device-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-texto-principal);
  margin: 0;
}

.device-panel {
  background: var(--color-superficie);
  border: 1px solid var(--color-borde);
  border-radius: 16px;
  padding: 1.25rem;
}

.device-panel__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-texto-principal);
  margin: 0 0 1rem;

  i { color: var(--color-principal); }
}

.device-grid {
  display: grid;
  gap: 1rem;
  
  &--3col {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }
}

.device-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 1rem;
  border-radius: 12px;
  background: var(--color-fondo);
}

.device-item__icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  
  &--exito { background: rgba(16, 185, 129, 0.12); color: #10b981; }
  &--advertencia { background: rgba(217, 119, 6, 0.12); color: #d97706; }
  &--peligro { background: rgba(239, 68, 68, 0.12); color: #ef4444; }
  &--neutral { background: rgba(107, 114, 128, 0.12); color: #6b7280; }
}

.device-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 50px;
  white-space: nowrap;

  &--exito { background: rgba(16, 185, 129, 0.15); color: #059669; }
  &--advertencia { background: rgba(217, 119, 6, 0.15); color: #b45309; }
  &--peligro { background: rgba(239, 68, 68, 0.15); color: #dc2626; }
  &--neutral { background: rgba(107, 114, 128, 0.15); color: #4b5563; }
}

.device-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 10px;
  padding: 9px 16px;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
  
  &:hover { opacity: 0.92; }
  
  &--primario {
    background: #380759;
    color: #fff;
  }
  
  &--icon {
    width: 40px;
    height: 40px;
    padding: 0;
    background: var(--color-superficie);
    border: 1.5px solid var(--color-borde);
    color: var(--color-principal);
  }
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.device-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0.75rem;
  border-radius: 10px;
  background: var(--color-fondo);
  
  i { color: var(--color-principal); }
}

.device-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.device-info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.device-info-item__label {
  font-size: 0.75rem;
  color: var(--color-texto-secundario);
}

.device-info-item__value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-texto-principal);
}

@media (max-width: 768px) {
  .device-grid--3col {
    grid-template-columns: 1fr;
  }
  
  .device-info-grid {
    grid-template-columns: 1fr;
  }
}
```

**Verificación**: `ng serve` debe mostrar la pantalla con estilos aplicados. Los colores deben coincidir con la paleta del resto de la aplicación. El responsive debe funcionar correctamente en móvil (probar con DevTools).

---

### ✅ **Paso 7: Implementar las secciones restantes (5-8) en la plantilla HTML**

Completar las 4 secciones faltantes en `device.html`.

**Archivos a crear/modificar**:
- `src/app/features/dashboard/device/device.html` (modificar, agregar secciones 5-8)

**Secciones a agregar**:

**5. Estado de Funcionalidades Críticas**:
```html
<div class="device-panel">
  <h2 class="device-panel__title">
    <i class="ti ti-activity"></i> Funcionalidades Críticas
  </h2>
  @if (criticalFeatures(); as features) {
    <div class="device-list">
      <div class="device-list-item">
        <i class="ti ti-login"></i>
        <span class="device-list-item__label">Sesión activa</span>
        <span class="device-badge" [ngClass]="features.sessionActive ? 'device-badge--exito' : 'device-badge--peligro'">
          {{ features.sessionActive ? 'Sí' : 'No' }}
        </span>
      </div>
      <div class="device-list-item">
        <i class="ti ti-map-pin"></i>
        <span class="device-list-item__label">Última ubicación</span>
        <span class="device-info-item__value">{{ features.lastLocationCaptured || 'No disponible' }}</span>
      </div>
      <div class="device-list-item">
        <i class="ti ti-users"></i>
        <span class="device-list-item__label">Contactos de emergencia</span>
        <span class="device-badge device-badge--exito">{{ features.emergencyContactsCount }}</span>
      </div>
    </div>
  }
</div>
```

**6. Registro de Actividad**:
```html
<div class="device-panel">
  <h2 class="device-panel__title">
    <i class="ti ti-history"></i> Registro de Actividad (Últimas 5)
  </h2>
  @if (activityLog().length > 0) {
    <div class="device-activity-list">
      @for (log of activityLog(); track log.timestamp) {
        <div class="device-activity-item">
          <div class="device-activity-item__icon" [ngClass]="'device-activity-item__icon--' + log.type">
            <i class="ti" [ngClass]="getIconForActivityType(log.type)"></i>
          </div>
          <div class="device-activity-item__body">
            <p class="device-activity-item__message">{{ log.message }}</p>
            <p class="device-activity-item__time">{{ log.timestamp }}</p>
          </div>
        </div>
      }
    </div>
  } @else {
    <p class="device-empty">Sin actividad reciente</p>
  }
</div>
```

**7. Pruebas de Funcionalidad**:
```html
<div class="device-panel">
  <h2 class="device-panel__title">
    <i class="ti ti-test-pipe"></i> Pruebas de Funcionalidad
  </h2>
  <div class="device-test-grid">
    <button class="device-test-btn" (click)="testGeolocation()">
      <i class="ti ti-map-pin"></i>
      <span>Probar Geolocalización</span>
    </button>
    <button class="device-test-btn" (click)="testNotifications()">
      <i class="ti ti-bell"></i>
      <span>Probar Notificaciones</span>
    </button>
    <button class="device-test-btn" (click)="testConnectivity()">
      <i class="ti ti-wifi"></i>
      <span>Probar Conectividad</span>
    </button>
  </div>
</div>
```

**8. Acciones Rápidas**:
```html
<div class="device-panel">
  <h2 class="device-panel__title">
    <i class="ti ti-bolt"></i> Acciones Rápidas
  </h2>
  <div class="device-actions-grid">
    <button class="device-action-btn" (click)="syncData()">
      <i class="ti ti-refresh"></i>
      <span>Sincronizar datos</span>
    </button>
    <button class="device-action-btn" (click)="clearCache()">
      <i class="ti ti-trash"></i>
      <span>Limpiar caché</span>
    </button>
    <button class="device-action-btn" (click)="exportDiagnostic()">
      <i class="ti ti-download"></i>
      <span>Exportar diagnóstico</span>
    </button>
    <button class="device-action-btn" (click)="refreshPermissions()">
      <i class="ti ti-shield-check"></i>
      <span>Refrescar permisos</span>
    </button>
  </div>
</div>
```

**Verificación**: `ng serve` debe mostrar las 8 secciones completas. Cada sección debe tener su título con icono, contenido estructurado, y botones funcionales (aunque aún no ejecuten la lógica completa).

---

### ✅ **Paso 8: Implementar los métodos de pruebas de funcionalidad en device.ts**

Completar la lógica de los botones "Probar Geolocalización", "Probar Notificaciones", "Probar Conectividad".

**Archivos a crear/modificar**:
- `src/app/features/dashboard/device/device.ts` (modificar, agregar métodos de prueba)

**Métodos a implementar**:

```typescript
testGeolocation(): void {
  if (!('geolocation' in navigator)) {
    alert('⚠️ La API de Geolocalización no está disponible en este navegador.');
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude.toFixed(6);
      const lng = position.coords.longitude.toFixed(6);
      const acc = position.coords.accuracy.toFixed(2);
      alert(`✅ Geolocalización OK\n\nLatitud: ${lat}\nLongitud: ${lng}\nPrecisión: ${acc}m`);
      this.addActivityLog('success', `Prueba de geolocalización exitosa: ${lat}, ${lng}`);
    },
    (error) => {
      alert(`❌ Error al obtener ubicación: ${error.message}`);
      this.addActivityLog('error', `Error en prueba de geolocalización: ${error.message}`);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

testNotifications(): void {
  if (!('Notification' in window)) {
    alert('⚠️ Las notificaciones no están disponibles en este navegador.');
    return;
  }
  
  if (Notification.permission === 'granted') {
    new Notification('🔔 Alerta Mujer', {
      body: 'Prueba de notificación exitosa',
      icon: '/logo.png',
      tag: 'test-notification'
    });
    alert('✅ Notificación enviada. Revisa tu bandeja de notificaciones.');
    this.addActivityLog('success', 'Prueba de notificación exitosa');
  } else if (Notification.permission === 'denied') {
    alert('❌ Permisos de notificación denegados. Ve a configuración del navegador para habilitarlos.');
  } else {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification('🔔 Alerta Mujer', {
          body: 'Permiso concedido. Prueba exitosa.',
          icon: '/logo.png'
        });
        this.addActivityLog('success', 'Permiso de notificación concedido y prueba exitosa');
        this.refreshPermissions(); // actualizar estado de permisos
      } else {
        alert('❌ Permiso de notificación denegado.');
        this.addActivityLog('warning', 'Permiso de notificación denegado por el usuario');
      }
    });
  }
}

testConnectivity(): void {
  const startTime = Date.now();
  const healthUrl = `${environment.apiUrl}/api/health`; // asumimos que existe este endpoint
  
  fetch(healthUrl, { method: 'GET' })
    .then(response => {
      const duration = Date.now() - startTime;
      if (response.ok) {
        alert(`✅ Conectividad OK\n\nTiempo de respuesta: ${duration}ms\nEstado: ${response.status}`);
        this.addActivityLog('success', `Prueba de conectividad exitosa (${duration}ms)`);
      } else {
        alert(`⚠️ Servidor respondió con error\n\nEstado: ${response.status}\nTiempo: ${duration}ms`);
        this.addActivityLog('warning', `Servidor respondió con error ${response.status}`);
      }
    })
    .catch(error => {
      const duration = Date.now() - startTime;
      alert(`❌ Error de conectividad\n\n${error.message}\nTiempo: ${duration}ms`);
      this.addActivityLog('error', `Error de conectividad: ${error.message}`);
    });
}

private addActivityLog(type: ActivityLog['type'], message: string): void {
  const log: ActivityLog = {
    timestamp: new Date().toLocaleString('es-ES'),
    type,
    message
  };
  
  // Agregar al principio y mantener solo las últimas 5
  const currentLogs = this.activityLog();
  const newLogs = [log, ...currentLogs].slice(0, 5);
  this.activityLog.set(newLogs);
  
  // Persistir en localStorage
  localStorage.setItem('device-activity-log', JSON.stringify(newLogs));
}
```

**Verificación**: Hacer clic en "Probar Geolocalización" debe solicitar permiso (si no está granted) y mostrar un alert con lat/lng. Hacer clic en "Probar Notificaciones" debe enviar una notificación de prueba. Hacer clic en "Probar Conectividad" debe hacer un fetch al backend y mostrar el tiempo de respuesta. Los logs deben aparecer en la sección "Registro de Actividad".

---

### ✅ **Paso 9: Implementar los métodos de acciones rápidas en device.ts**

Completar la lógica de "Sincronizar datos", "Limpiar caché", "Exportar diagnóstico", "Refrescar permisos".

**Archivos a crear/modificar**:
- `src/app/features/dashboard/device/device.ts` (modificar, agregar métodos de acciones rápidas)

**Métodos a implementar**:

```typescript
syncData(): void {
  this.loading.set(true);
  
  // Simular sincronización haciendo peticiones GET a endpoints principales
  const syncPromises = [
    this.http.get(`${environment.apiUrl}/api/contacts`).toPromise(),
    this.http.get(`${environment.apiUrl}/api/zones`).toPromise(),
    this.http.get(`${environment.apiUrl}/api/saved-routes`).toPromise(),
  ];
  
  Promise.allSettled(syncPromises)
    .then(results => {
      const successful = results.filter(r => r.status === 'fulfilled').length;
      alert(`✅ Sincronización completada\n\n${successful} de ${results.length} endpoints sincronizados.`);
      this.addActivityLog('success', `Sincronización completada: ${successful}/${results.length} exitosos`);
    })
    .catch(() => {
      alert('❌ Error durante la sincronización');
      this.addActivityLog('error', 'Error durante la sincronización de datos');
    })
    .finally(() => {
      this.loading.set(false);
    });
}

clearCache(): void {
  const confirmed = confirm('¿Estás segura de que deseas limpiar el caché local?\n\nEsto NO cerrará tu sesión ni eliminará datos guardados en el servidor.');
  
  if (!confirmed) return;
  
  // Limpiar solo claves específicas, NO la sesión ni el auth
  const keysToRemove = ['device-activity-log', 'temp-location', 'draft-route'];
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  alert('✅ Caché limpiado correctamente.');
  this.addActivityLog('info', 'Caché local limpiado');
  
  // Recargar logs (ahora vacío)
  this.loadActivityLog();
}

exportDiagnostic(): void {
  const diagnostic = {
    timestamp: new Date().toISOString(),
    deviceInfo: this.deviceInfo(),
    permissions: this.permissions(),
    services: this.services(),
    isOnline: this.isOnline(),
    connectionQuality: this.connectionQuality(),
    criticalFeatures: this.criticalFeatures(),
    activityLog: this.activityLog(),
    userAgent: navigator.userAgent,
    screenInfo: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth
    }
  };
  
  const blob = new Blob([JSON.stringify(diagnostic, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `diagnostico-alerta-mujer-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  
  alert('✅ Diagnóstico exportado correctamente.');
  this.addActivityLog('info', 'Diagnóstico exportado');
}

refreshPermissions(): void {
  this.loading.set(true);
  this.loadPermissions();
  setTimeout(() => {
    this.loading.set(false);
    alert('✅ Permisos actualizados.');
    this.addActivityLog('info', 'Estado de permisos actualizado');
  }, 500);
}

refreshAll(): void {
  this.loading.set(true);
  this.loadDeviceInfo();
  this.loadPermissions();
  this.loadServices();
  this.loadCriticalFeatures();
  this.loadActivityLog();
  this.lastRefresh.set(new Date().toLocaleTimeString('es-ES'));
  setTimeout(() => {
    this.loading.set(false);
    this.addActivityLog('info', 'Pantalla actualizada completamente');
  }, 800);
}
```

**Verificación**: Hacer clic en "Sincronizar datos" debe hacer peticiones GET a los endpoints y mostrar un resumen. Hacer clic en "Limpiar caché" debe confirmar y limpiar localStorage. Hacer clic en "Exportar diagnóstico" debe descargar un archivo JSON con toda la información de la pantalla. Hacer clic en "Refrescar permisos" debe volver a consultar el estado de permisos.

---

### ✅ **Paso 10: Implementar el método loadCriticalFeatures() en device.ts**

Este método debe consultar información de la sesión activa, última ubicación, token de notificaciones, y cantidad de contactos de emergencia.

**Archivos a crear/modificar**:
- `src/app/features/dashboard/device/device.ts` (modificar, agregar método loadCriticalFeatures)

**Método a implementar**:

```typescript
private loadCriticalFeatures(): void {
  // 1. Verificar sesión activa
  const sessionActive = this.authService.isAuthenticated(); // método existente en AuthService
  
  // 2. Obtener última ubicación del localStorage (donde mi-ubicacion la guarda)
  const lastLocationStr = localStorage.getItem('last-location');
  let lastLocationCaptured: string | null = null;
  if (lastLocationStr) {
    try {
      const loc = JSON.parse(lastLocationStr);
      lastLocationCaptured = `${new Date(loc.timestamp).toLocaleString('es-ES')} - ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
    } catch {
      lastLocationCaptured = 'Error al parsear';
    }
  }
  
  // 3. Token de notificaciones (si se guarda en localStorage)
  const notificationToken = localStorage.getItem('fcm-token') || null;
  
  // 4. Obtener cantidad de contactos de emergencia
  this.emergencyContactService.getAll()
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (contacts) => {
        this.criticalFeatures.set({
          sessionActive,
          lastLocationCaptured,
          notificationToken,
          emergencyContactsCount: contacts.length
        });
      },
      error: () => {
        this.criticalFeatures.set({
          sessionActive,
          lastLocationCaptured,
          notificationToken,
          emergencyContactsCount: 0
        });
      }
    });
}
```

**Dependencias a inyectar en el constructor/inject**:
```typescript
private emergencyContactService = inject(EmergencyContactService);
private http = inject(HttpClient);
```

**Verificación**: La sección "Funcionalidades Críticas" debe mostrar: sesión activa (Sí/No), última ubicación capturada (fecha + coordenadas o "No disponible"), y cantidad de contactos de emergencia (número). Los datos deben ser reales (no dummy).

---

### ✅ **Paso 11: Implementar el método loadActivityLog() en device.ts**

Este método debe cargar el registro de actividad desde localStorage.

**Archivos a crear/modificar**:
- `src/app/features/dashboard/device/device.ts` (modificar, agregar método loadActivityLog)

**Método a implementar**:

```typescript
private loadActivityLog(): void {
  const logsStr = localStorage.getItem('device-activity-log');
  if (logsStr) {
    try {
      const logs: ActivityLog[] = JSON.parse(logsStr);
      this.activityLog.set(logs.slice(0, 5)); // solo las últimas 5
    } catch {
      this.activityLog.set([]);
    }
  } else {
    this.activityLog.set([]);
  }
}
```

**Verificación**: Si hay logs en localStorage (clave `device-activity-log`), deben mostrarse en la sección "Registro de Actividad". Si no hay, debe mostrarse "Sin actividad reciente". Cada log debe tener icono, mensaje y timestamp.

---

### ✅ **Paso 12: Implementar el método loadServices() en device.ts**

Este método debe verificar el estado de servicios: GPS, conectividad (online/offline), calidad de conexión.

**Archivos a crear/modificar**:
- `src/app/features/dashboard/device/device.ts` (modificar, agregar método loadServices)

**Método a implementar**:

```typescript
private loadServices(): void {
  const services: ServiceStatus[] = [];
  
  // 1. Estado de GPS (derivado del permiso de geolocation)
  this.permissionsService.checkPermission('geolocation')
    .pipe(takeUntil(this.destroy$))
    .subscribe(perm => {
      services.push({
        name: 'GPS',
        enabled: perm.state === 'granted',
        details: perm.state === 'granted' ? 'Activo' : 'Inactivo o sin permiso'
      });
      this.services.set([...services]);
    });
  
  // 2. Conectividad (online/offline)
  this.deviceInfoService.isOnline()
    .pipe(takeUntil(this.destroy$))
    .subscribe(online => {
      this.isOnline.set(online);
      const idx = services.findIndex(s => s.name === 'Conectividad');
      if (idx >= 0) {
        services[idx].enabled = online;
      } else {
        services.push({
          name: 'Conectividad',
          enabled: online,
          details: online ? 'En línea' : 'Sin conexión'
        });
      }
      this.services.set([...services]);
    });
  
  // 3. Calidad de conexión (usando Network Information API si disponible)
  const quality = this.deviceInfoService.getConnectionQuality();
  this.connectionQuality.set(quality);
  services.push({
    name: 'Calidad de conexión',
    enabled: quality !== 'Desconocida',
    details: quality
  });
  
  this.services.set(services);
}
```

**Verificación**: La sección "Estado de Servicios" debe mostrar 3 ítems: GPS (activo si permiso granted), Conectividad (activo si navigator.onLine es true), Calidad de conexión (muestra el tipo de red si disponible, o "Desconocida"). Los estados deben actualizarse en tiempo real (ej: si desconecto el wifi, "Conectividad" debe pasar a Inactivo).

---

### ✅ **Paso 13: Agregar métodos auxiliares para iconos y colores en device.ts**

Métodos helper para mapear estados a iconos y colores semánticos.

**Archivos a crear/modificar**:
- `src/app/features/dashboard/device/device.ts` (modificar, agregar métodos auxiliares)

**Métodos a implementar**:

```typescript
getStatusColor(state: PermissionStatus['state']): string {
  switch (state) {
    case 'granted': return 'exito';
    case 'denied': return 'peligro';
    case 'prompt': return 'advertencia';
    case 'unavailable': return 'neutral';
    default: return 'neutral';
  }
}

getStatusLabel(state: PermissionStatus['state']): string {
  switch (state) {
    case 'granted': return 'Concedido';
    case 'denied': return 'Denegado';
    case 'prompt': return 'Pendiente';
    case 'unavailable': return 'No disponible';
    default: return 'Desconocido';
  }
}

getIconForPermission(name: string): string {
  switch (name) {
    case 'geolocation': return 'ti-map-pin';
    case 'notifications': return 'ti-bell';
    case 'camera': return 'ti-camera';
    case 'microphone': return 'ti-microphone';
    case 'clipboard-read': return 'ti-clipboard';
    default: return 'ti-shield';
  }
}

getIconForActivityType(type: ActivityLog['type']): string {
  switch (type) {
    case 'success': return 'ti-check';
    case 'error': return 'ti-x';
    case 'warning': return 'ti-alert-triangle';
    case 'info': return 'ti-info-circle';
    default: return 'ti-info-circle';
  }
}
```

**Verificación**: Los iconos en la sección "Permisos del Navegador" deben corresponder al tipo de permiso (ti-map-pin para geolocalización, ti-bell para notificaciones, etc.). Los colores de los badges deben ser semánticos (verde para granted, rojo para denied, amarillo para prompt, gris para unavailable).

---

### ✅ **Paso 14: Agregar estilos para las secciones 5-8 en device.scss**

Completar los estilos de las secciones de actividad, pruebas y acciones.

**Archivos a crear/modificar**:
- `src/app/features/dashboard/device/device.scss` (modificar, agregar estilos para actividad, pruebas, acciones)

**Estilos a agregar**:

```scss
// Registro de Actividad
.device-activity-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.device-activity-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 0.75rem;
  border-radius: 10px;
  background: var(--color-fondo);
}

.device-activity-item__icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
  
  &--success { background: rgba(16, 185, 129, 0.12); color: #10b981; }
  &--error { background: rgba(239, 68, 68, 0.12); color: #ef4444; }
  &--warning { background: rgba(217, 119, 6, 0.12); color: #d97706; }
  &--info { background: rgba(8, 145, 178, 0.12); color: #0891b2; }
}

.device-activity-item__body {
  flex: 1;
  min-width: 0;
}

.device-activity-item__message {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-texto-principal);
  margin: 0 0 4px;
}

.device-activity-item__time {
  font-size: 0.75rem;
  color: var(--color-texto-secundario);
  margin: 0;
}

// Pruebas de Funcionalidad
.device-test-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.device-test-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 1.25rem 1rem;
  border-radius: 12px;
  border: 1.5px solid var(--color-borde);
  background: var(--color-superficie);
  color: var(--color-principal);
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  
  i {
    font-size: 1.5rem;
    color: var(--color-principal);
  }
  
  &:hover {
    background: var(--color-fondo);
    border-color: var(--color-principal);
  }
}

// Acciones Rápidas
.device-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.device-action-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 1rem;
  border-radius: 12px;
  border: none;
  background: var(--color-fondo);
  color: var(--color-texto-principal);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  
  i {
    font-size: 1.2rem;
    color: var(--color-principal);
  }
  
  &:hover {
    background: rgba(109, 40, 217, 0.12);
  }
}

.device-empty {
  font-size: 0.875rem;
  color: var(--color-texto-secundario);
  text-align: center;
  padding: 2rem 1rem;
  margin: 0;
}

@media (max-width: 768px) {
  .device-test-grid,
  .device-actions-grid {
    grid-template-columns: 1fr;
  }
}
```

**Verificación**: `ng serve` debe mostrar todas las secciones con sus estilos correctos. Los botones de prueba deben tener estilo de card con icono + texto. Los botones de acciones rápidas deben tener estilo horizontal con icono a la izquierda. El registro de actividad debe mostrar cada log con icono de color semántico.

---

### ✅ **Paso 15: Verificar que el componente Device esté registrado en las rutas**

El componente ya está registrado en `app.routes.ts` en la ruta `/dashboard/device`, pero debemos verificar que el import lazy funcione.

**Archivos a verificar**:
- `src/app/app.routes.ts` (verificar ruta existente)

**Verificación**: La ruta ya existe:
```typescript
{
  path: 'device',
  loadComponent: () =>
    import('./features/dashboard/device/device')
      .then(m => m.Device),
}
```

Confirmar que al navegar a `/dashboard/device` se cargue el componente sin errores de importación.

**Verificación**: Navegar a `http://localhost:4200/dashboard/device` desde el navegador (estando autenticado). La pantalla de "Estado del Dispositivo" debe cargarse completamente con todas las 8 secciones visibles y funcionales.

---

### ✅ **Paso 16: Agregar el import de HttpClient en device.ts**

El componente usa `HttpClient` en los métodos `syncData()` y `testConnectivity()`, así que debe importarse.

**Archivos a crear/modificar**:
- `src/app/features/dashboard/device/device.ts` (modificar, agregar import y dependencia)

**Cambios**:

1. Agregar import:
```typescript
import { HttpClient } from '@angular/common/http';
```

2. Agregar al array `imports` del decorador @Component:
```typescript
@Component({
  selector: 'app-device',
  standalone: true,
  imports: [CommonModule, RouterLink], // agregar HttpClient NO va aquí, se inyecta
  templateUrl: './device.html',
  styleUrl: './device.scss',
})
```

3. Inyectar en el componente:
```typescript
private http = inject(HttpClient);
```

**Verificación**: `ng build` debe compilar sin errores de tipo. Los métodos `syncData()` y `testConnectivity()` deben poder ejecutarse sin errores de inyección.

---

### ✅ **Paso 17: Agregar import de environment en device.ts**

El componente usa `environment.apiUrl` en varios métodos.

**Archivos a crear/modificar**:
- `src/app/features/dashboard/device/device.ts` (modificar, agregar import)

**Cambios**:

Agregar import:
```typescript
import { environment } from '../../../environments/environment';
```

**Verificación**: `ng build` debe compilar. Los métodos que usan `environment.apiUrl` deben funcionar sin errores de referencia.

---

### ✅ **Paso 18: Agregar operadores RxJS faltantes en device.ts**

El componente usa operadores RxJS como `takeUntil`, `map`, `catchError`, `from`, `of`, `forkJoin`.

**Archivos a crear/modificar**:
- `src/app/features/dashboard/device/device.ts` (modificar, agregar imports RxJS)

**Cambios**:

Agregar imports:
```typescript
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
```

**Verificación**: `ng build` debe compilar sin errores de importación RxJS. Todos los observables deben funcionar correctamente.

---

### ✅ **Paso 19: Implementar el método getConnectionQuality() en DeviceInfoService**

Este método debe usar la Network Information API para obtener el tipo de conexión.

**Archivos a crear/modificar**:
- `src/app/core/services/device-info.service.ts` (modificar, agregar método getConnectionQuality)

**Método a implementar**:

```typescript
getConnectionQuality(): string {
  // Network Information API (experimental, no disponible en todos los navegadores)
  const nav = navigator as any;
  if ('connection' in nav && nav.connection) {
    const conn = nav.connection;
    const type = conn.effectiveType || conn.type || 'Desconocida';
    const downlink = conn.downlink ? ` (${conn.downlink} Mbps)` : '';
    return `${type}${downlink}`;
  }
  return 'Desconocida';
}
```

**Verificación**: En navegadores con soporte (Chrome, Edge), debe retornar el tipo de conexión (4g, wifi, etc.). En navegadores sin soporte (Firefox, Safari), debe retornar "Desconocida".

---

### ✅ **Paso 20: Prueba de integración completa del componente Device**

Verificar que todas las funcionalidades de la pantalla funcionan end-to-end.

**Archivos involucrados**: todos los creados/modificados en los pasos anteriores.

**Pasos de verificación**:

1. **Build**: Ejecutar `ng build` y confirmar que compila sin errores ni warnings relevantes.
   
2. **Servidor de desarrollo**: Ejecutar `ng serve` y navegar a `http://localhost:4200/dashboard/device`.

3. **Verificación visual**: Confirmar que las 8 secciones se muestran correctamente:
   - Encabezado con título + botón refresh
   - Permisos del Navegador (5 permisos con badges de color)
   - Estado de Servicios (GPS, Conectividad, Calidad de conexión)
   - Información del Dispositivo (navegador, SO, idioma, zona horaria, resolución)
   - Funcionalidades Críticas (sesión, última ubicación, contactos)
   - Registro de Actividad (últimas 5 entradas o "Sin actividad")
   - Pruebas de Funcionalidad (3 botones)
   - Acciones Rápidas (4 botones)

4. **Verificación funcional**:
   - Hacer clic en "Probar Geolocalización" → debe solicitar permiso y mostrar coordenadas
   - Hacer clic en "Probar Notificaciones" → debe enviar notificación de prueba
   - Hacer clic en "Probar Conectividad" → debe hacer fetch al backend y mostrar tiempo de respuesta
   - Hacer clic en "Sincronizar datos" → debe hacer peticiones y mostrar resumen
   - Hacer clic en "Limpiar caché" → debe confirmar y limpiar localStorage
   - Hacer clic en "Exportar diagnóstico" → debe descargar archivo JSON
   - Hacer clic en "Refrescar permisos" → debe actualizar estados
   - Hacer clic en el botón refresh del encabezado → debe recargar toda la pantalla

5. **Verificación responsive**: Reducir el ancho del navegador a 768px y 375px. Todas las secciones deben adaptarse a una columna y ser legibles.

6. **Verificación de errores**: Desconectar el wifi y confirmar que "Conectividad" pasa a "Inactivo". Volver a conectar y confirmar que pasa a "Activo".

7. **Verificación de logs**: Ejecutar varias acciones de prueba y confirmar que aparecen en "Registro de Actividad" con timestamp correcto.

**Resultado esperado**: Todas las verificaciones deben pasar. La pantalla debe ser funcional, responsive, y sin errores en la consola del navegador.

**Comando de verificación final**: `ng build --configuration production` debe compilar sin errores y generar el bundle optimizado.

---

## Resumen del Plan

**Total de pasos**: 20

**Archivos a crear**:
- `src/app/core/models/device-info.model.ts`
- `src/app/core/services/device-info.service.ts`
- `src/app/core/services/permissions.service.ts`

**Archivos a modificar**:
- `src/app/features/dashboard/device/device.ts`
- `src/app/features/dashboard/device/device.html`
- `src/app/features/dashboard/device/device.scss`

**Archivos a verificar (ya existen)**:
- `src/app/app.routes.ts` (ruta `/dashboard/device` ya registrada)

**Dependencias externas**: Ninguna nueva. El proyecto ya tiene Angular 18+, RxJS, Leaflet, Tabler Icons.

**APIs del navegador usadas**:
- Navigator API (userAgent, language, onLine)
- Geolocation API (getCurrentPosition)
- Permissions API (query)
- Notification API (requestPermission, new Notification)
- Screen API (width, height, colorDepth)
- Network Information API (connection, effectiveType) - experimental
- Storage API (localStorage)
- Fetch API (para test de conectividad)

**Patrones seguidos**:
- Servicios: `@Injectable({ providedIn: 'root' })`, inyección con `inject()`
- Componentes: standalone, signals (`signal`, `computed`), imports explícitos
- Estilos: variables CSS en `:host`, clases BEM-like, responsive con media queries
- Iconos: Tabler Icons (clases `ti ti-*`)
- Colores semánticos: verde (éxito), amarillo (advertencia), rojo (peligro), gris (neutral), morado (principal)

**Testing**: Cada paso incluye una verificación específica (build, serve, prueba funcional, responsive).

---

**Fin del Plan de Implementación**
