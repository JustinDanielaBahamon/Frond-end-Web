# Implementation Plan: Dashboard Module Updates

This plan covers three module changes for the Alerta Mujer web dashboard: Assistance (color palette alignment), Device (mobile-centric focus), and Settings (removing security card, adding missing colors, clarifying labels).

**Project Context:**
- Angular 21.2 standalone components with signals
- Build command: `npm run build` (production build to dist/)
- Test command: `npm test` (Vitest)
- Dev server: `npm start` (http://localhost:4200)
- Color palette tokens: defined in `src/shared/styles/variables.scss` and `src/shared/styles/tokens.scss`

**Order of changes:** Assistance → Device → Settings (no cross-dependencies, but this ordering groups cosmetic changes before structural changes)

---

## Module 1: ASSISTANCE — Color Palette Remapping

### Background
The CATEGORIAS map in `assistance.ts` currently assigns colors that don't fully align with the app's violet/purple design palette. The user wants all non-danger colors to use the violet/purple/teal palette consistently.

- [ ] **1. Update CATEGORIAS color values in assistance.ts**

Update the `CATEGORIAS` constant color values to match the violet/purple palette. Keep danger colors (red for bomberos).

**Files:**
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/assistance/assistance.ts`

**Changes:**
In `assistance.ts` (around line 12-18), replace the CATEGORIAS object:

```typescript
export const CATEGORIAS: Record<CategoriaRecurso, { etiqueta: string; color: string }> = {
  linea: { etiqueta: 'Línea de ayuda', color: '#8b5cf6' },      // was '#f59e0b' amber → violet secondary
  policia: { etiqueta: 'Policía', color: '#7c3aed' },           // was '#9333ea' → refine to primary violet
  salud: { etiqueta: 'Salud', color: '#0891b2' },               // was '#3b82f6' blue → accent teal
  apoyo: { etiqueta: 'Apoyo a la mujer', color: '#6d28d9' },    // was '#ec4899' pink → primary violet
  bomberos: { etiqueta: 'Bomberos', color: '#ef4444' },         // KEEP red (danger color)
};
```

**Rationale:** This aligns the category color palette with the app's primary violet (#7c3aed), secondary violet (#8b5cf6, #6d28d9), accent teal (#0891b2), and danger red (#ef4444).

**Verify:** 
```bash
npm run build
```
Expected: Build succeeds with no TypeScript errors.

- [ ] **2. Update call button color from green to violet in assistance.scss**

Change the `$call` variable and related button styles from green to violet to match the palette.

**Files:**
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/assistance/assistance.scss`

**Changes:**
In `assistance.scss` (around line 9), change the `$call` variable:

```scss
$call: #7c3aed;  // was #16a34a (green) → violet
```

This affects `.as-btn--call` background (line ~202 in the current file).

**Rationale:** The green call button was inconsistent with the violet/purple branding. Violet unifies the UI. The SOS button stays red (danger).

**Verify:**
```bash
npm run build
```
Expected: Build succeeds. Visual inspection: call buttons in Assistance module show violet background instead of green.

- [ ] **3. Update user location pin color from indigo to violet in assistance.scss**

Change the `.as-you` pin color on the map from indigo to violet.

**Files:**
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/assistance/assistance.scss`

**Changes:**
In `assistance.scss` (around line 334), update the `.as-you` class:

```scss
:host ::ng-deep .as-you {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #7c3aed;  // was #6366f1 (indigo) → violet
  border: 3px solid #fff;
  box-shadow: 0 0 0 6px rgba(124, 58, 237, 0.25);  // update shadow to match new color
}
```

**Rationale:** User location pin should match the primary violet brand color, not indigo.

**Verify:**
```bash
npm start
```
Navigate to `/dashboard/asistencia`, go to "Centros de atención" tab, click "Cerca de mí" to show user location on map. Expected: user pin is violet (not indigo).

---

## Module 2: DEVICE — Mobile-Centric Focus

### Background
The Device module currently shows browser/laptop info (navigator.userAgent, screen resolution) and has browser-centric test functions. The user wants it to focus on the registered mobile device from the backend, not the web browser.

- [ ] **4. Rename page title from 'Estado del Dispositivo' to 'Estado del Dispositivo Móvil' in device.html**

Update the main title and subtitle to clarify the focus is on the mobile device.

**Files:**
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/device/device.html`

**Changes:**
In `device.html` (around line 5-6), update:

```html
<h1 class="device-title">Estado del Dispositivo Móvil</h1>
<p class="device-subtitle">Estado del celular vinculado y funcionalidades de la app móvil • Última actualización: {{ lastRefresh() }}</p>
```

**Verify:**
```bash
npm run build
```
Expected: Build succeeds, title shows "Estado del Dispositivo Móvil".

- [ ] **5. Rename 'Permisos del Navegador' panel to 'Permisos del Celular (App Móvil)' and grey out items with explanatory note**

Rename the panel title and add a note explaining these are mobile app permissions verified on the phone.

**Files:**
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/device/device.html`
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/device/device.scss`

**Changes:**

In `device.html` (around line 12-13), update the panel title:

```html
<h2 class="device-panel__title">
  <i class="ti ti-shield-check"></i> Permisos del Celular (App Móvil)
</h2>
<p class="device-permissions-note">
  <i class="ti ti-info-circle"></i>
  <span>Estos permisos son gestionados desde la app móvil en tu celular, no desde el navegador web. Para verificar o cambiar los permisos, abre la configuración de la app en tu teléfono.</span>
</p>
```

In `device.html` (around line 21-30), add `device-item--readonly` class to each permission item:

```html
<div class="device-item device-item--readonly" role="status" ...>
```

In `device.scss`, add after the `.device-item` definition (around line 182):

```scss
.device-item--readonly {
  opacity: 0.65;
  cursor: not-allowed;
  
  &::after {
    content: 'Verificar en el celular';
    position: absolute;
    bottom: 8px;
    right: 8px;
    font-size: var(--font-size-xs);
    color: var(--color-texto-secundario);
    background: var(--color-fondo);
    padding: 2px 6px;
    border-radius: 4px;
  }
}
```

**Rationale:** Clarifies that these permissions are mobile app settings, not browser settings manageable from the web dashboard.

**Verify:**
```bash
npm run build
```
Expected: Build succeeds. Visual check: permission items are greyed out with "Verificar en el celular" label.

- [ ] **6. Rename 'Información del Dispositivo' panel to 'Dispositivo Móvil Vinculado' and replace browser info with mobile device data**

Replace browser detection fields with mobile device data from the backend (`DeviceService.getMyDevices()`).

**Files:**
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/device/device.html`
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/device/device.ts`

**Changes:**

In `device.html` (around line 68), update panel title:

```html
<h2 class="device-panel__title">
  <i class="ti ti-device-mobile"></i> Dispositivo Móvil Vinculado
</h2>
```

In `device.html` (around line 70-85), replace the browser info grid with mobile device info:

```html
@if (mobileDevice(); as device) {
  <div class="device-info-grid">
    <div class="device-info-item">
      <span class="device-info-item__label">Modelo</span>
      <span class="device-info-item__value">{{ device.brand }} {{ device.model || 'Desconocido' }}</span>
    </div>
    <div class="device-info-item">
      <span class="device-info-item__label">Sistema Operativo</span>
      <span class="device-info-item__value">{{ device.osName }} {{ device.osVersion || '' }}</span>
    </div>
    <div class="device-info-item">
      <span class="device-info-item__label">Versión de la App</span>
      <span class="device-info-item__value">{{ device.appVersion || 'No disponible' }}</span>
    </div>
    <div class="device-info-item">
      <span class="device-info-item__label">Estado GPS</span>
      <span class="device-info-item__value">{{ device.gpsStatus || 'Desconocido' }}</span>
    </div>
    <div class="device-info-item">
      <span class="device-info-item__label">Estado del Celular</span>
      <span class="device-info-item__value">{{ device.status }}</span>
    </div>
    <div class="device-info-item">
      <span class="device-info-item__label">Último Acceso</span>
      <span class="device-info-item__value">{{ device.lastAccess ? formatDate(device.lastAccess) : 'Nunca' }}</span>
    </div>
    <div class="device-info-item">
      <span class="device-info-item__label">Token Push</span>
      <span class="device-info-item__value">{{ device.fcmToken ? 'Configurado' : 'No configurado' }}</span>
    </div>
  </div>
} @else {
  <p class="device-empty">No hay celular vinculado. Registra tu celular desde la app móvil.</p>
}
```

In `device.ts`, add a new `mobileDevice` signal (around line 46, after `featuresLoading`):

```typescript
mobileDevice = signal<UserDevice | null>(null);
```

In `device.ts`, update `fetchCriticalFeatures()` method (around line 142) to set the mobile device:

```typescript
private fetchCriticalFeatures(): Observable<boolean> {
  const userId = this.currentUserId;
  if (!userId) {
    return of(false);
  }

  if (!this.criticalFeatures()) {
    this.criticalFeatures.set({
      sessionActive: this.authService.isLoggedIn(),
      lastLocationCaptured: null,
      registeredDevices: null,
      pushTokenRegistered: false,
      emergencyContactsCount: null
    });
  }
  this.featuresLoading.set(true);

  const FAILED = 'failed' as const;
  return forkJoin({
    contacts: this.contactService.getByUsuario(userId).pipe(catchError(() => of(null))),
    devices: this.deviceService.getMyDevices().pipe(catchError(() => of(null))),
    latest: this.locationService.getLatest().pipe(catchError(() => of(FAILED)))
  }).pipe(
    map(({ contacts, devices, latest }) => {
      // Set the first mobile device (or null)
      this.mobileDevice.set(devices && devices.length > 0 ? devices[0] : null);
      
      this.criticalFeatures.set({
        sessionActive: this.authService.isLoggedIn(),
        lastLocationCaptured: latest === FAILED ? 'No disponible' : latest ? this.formatLocation(latest) : null,
        registeredDevices: devices ? devices.length : null,
        pushTokenRegistered: !!devices?.some(d => !!d.fcmToken),
        emergencyContactsCount: contacts ? contacts.length : null
      });
      return contacts !== null && devices !== null && latest !== FAILED;
    }),
    finalize(() => this.featuresLoading.set(false)),
    takeUntil(this.destroy$)
  );
}
```

Add `formatDate()` helper method in `device.ts` (around line 180):

```typescript
formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-CO', { 
    day: '2-digit', 
    month: 'short', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}
```

Add import for `UserDevice` at the top of `device.ts`:

```typescript
import { UserDevice } from '../../../core/services/device.service';
```

**Rationale:** Shifts focus from web browser information (which is irrelevant for a mobile safety app) to the actual registered mobile device data from the backend.

**Verify:**
```bash
npm run build && npm start
```
Navigate to `/dashboard/device`. Expected: "Dispositivo Móvil Vinculado" panel shows mobile device data (model, OS, app version, GPS status, last access, token status) instead of browser info. If no device is registered, shows empty state message.

- [ ] **7. Update 'Estado de Servicios' to show mobile-centric services instead of browser APIs**

Remove browser-specific service entries ('GPS / Geolocalización', 'Almacenamiento Local', 'Notificaciones Push browser') and replace with mobile backend data.

**Files:**
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/device/device.ts`

**Changes:**

In `device.ts`, replace the `loadServices()` method (around line 115):

```typescript
private loadServices(): void {
  const features = this.criticalFeatures();
  const services: ServiceStatus[] = [
    {
      name: 'Celular Vinculado',
      enabled: !!this.mobileDevice(),
      details: this.mobileDevice() ? 'Dispositivo registrado en el sistema' : 'No hay celular vinculado'
    },
    {
      name: 'Token Push Activo',
      enabled: features?.pushTokenRegistered ?? false,
      details: 'Permite enviar notificaciones al celular'
    },
    {
      name: 'Última Ubicación Registrada',
      enabled: !!features?.lastLocationCaptured && features.lastLocationCaptured !== 'No disponible',
      details: features?.lastLocationCaptured ?? 'Sin ubicaciones registradas'
    },
    {
      name: 'Conectividad Web',
      enabled: navigator.onLine,
      details: 'Conexión del panel web al servidor'
    }
  ];

  this.services.set(services);
  this.connectionQuality.set(this.deviceInfoService.getConnectionQuality());
}
```

Update the call to `loadServices()` in `fetchCriticalFeatures()` callback to refresh services after features are loaded. In `device.ts`, after the line `this.criticalFeatures.set({...})` inside `fetchCriticalFeatures()` (around line 160), add:

```typescript
this.loadServices();  // Refresh services with new mobile data
```

Also call `loadServices()` when `mobileDevice` changes. In `ngOnInit()`, after `loadServices()` (around line 78), add an effect:

```typescript
// Refresh services when mobile device data changes
effect(() => {
  this.mobileDevice();
  this.criticalFeatures();
  this.loadServices();
}, { allowSignalWrites: true });
```

Wait — effects should not be in `ngOnInit()`. Instead, move this logic: when `fetchCriticalFeatures()` completes, call `loadServices()`. The placement after `this.criticalFeatures.set()` in the map operator should work. If not, call it in finalize block:

```typescript
.pipe(
  map(({ contacts, devices, latest }) => {
    this.mobileDevice.set(devices && devices.length > 0 ? devices[0] : null);
    
    this.criticalFeatures.set({
      sessionActive: this.authService.isLoggedIn(),
      lastLocationCaptured: latest === FAILED ? 'No disponible' : latest ? this.formatLocation(latest) : null,
      registeredDevices: devices ? devices.length : null,
      pushTokenRegistered: !!devices?.some(d => !!d.fcmToken),
      emergencyContactsCount: contacts ? contacts.length : null
    });
    
    // Refresh services after critical features and mobile device are set
    this.loadServices();
    
    return contacts !== null && devices !== null && latest !== FAILED;
  }),
  finalize(() => this.featuresLoading.set(false)),
  takeUntil(this.destroy$)
);
```

**Rationale:** Services list now reflects mobile backend status (celular vinculado, token push, ubicación del celular) instead of browser APIs. Web connectivity is kept since it's relevant for the dashboard itself.

**Verify:**
```bash
npm run build && npm start
```
Expected: "Estado de Servicios" panel shows: Celular Vinculado (enabled if device registered), Token Push Activo (enabled if FCM token exists), Última Ubicación Registrada (enabled if location data exists), Conectividad Web (enabled if online).

- [ ] **8. Update 'Pruebas de Funcionalidad' panel: remove browser tests, add mobile location viewer**

Remove 'Probar Geolocalización' and 'Mostrar Notificación' buttons (browser-centric). Rename 'Solicitar Permiso' to 'Ver Permisos Push Móvil'. Add 'Ver Ubicación Móvil' button.

**Files:**
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/device/device.html`
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/device/device.ts`

**Changes:**

In `device.html` (around line 155-175), replace the test buttons grid:

```html
<div class="device-test-grid">
  <button class="device-test-btn" (click)="viewMobileLocation()" [disabled]="loading()" aria-label="Ver última ubicación del celular">
    <i class="ti ti-map-pin"></i>
    <span>Ver Ubicación Móvil</span>
  </button>
  <button class="device-test-btn" (click)="viewPushPermissions()" [disabled]="loading()" aria-label="Ver estado de permisos push del celular">
    <i class="ti ti-bell"></i>
    <span>Ver Permisos Push Móvil</span>
  </button>
  <button class="device-test-btn" (click)="testConnectivity()" [disabled]="loading()" aria-label="Probar conectividad de red">
    <i class="ti ti-wifi"></i>
    <span>Probar Conectividad</span>
  </button>
</div>
```

In `device.ts`, remove `testGeolocation()` and `testNotificationDisplay()` methods (around lines 222-260).

In `device.ts`, remove `requestNotificationPermission()` method (around lines 262-285).

Add new methods in `device.ts` (around line 290, after `testConnectivity()`):

```typescript
viewMobileLocation(): void {
  const features = this.criticalFeatures();
  if (!features?.lastLocationCaptured || features.lastLocationCaptured === 'No disponible') {
    alert('⚠️ No hay ubicación registrada\n\nLa app móvil aún no ha enviado ninguna ubicación al servidor. Asegúrate de que la app tenga permisos de ubicación activados en tu celular.');
    return;
  }
  
  alert(`📍 Última ubicación del celular\n\n${features.lastLocationCaptured}\n\nPara ver esta ubicación en el mapa, ve a la sección Ubicación en el menú principal.`);
  this.addActivityLog('info', 'Consultada última ubicación móvil');
}

viewPushPermissions(): void {
  const device = this.mobileDevice();
  if (!device) {
    alert('⚠️ No hay celular vinculado\n\nPrimero registra tu celular desde la app móvil.');
    return;
  }
  
  const status = device.fcmToken ? '✅ Configurado' : '❌ No configurado';
  const message = device.fcmToken
    ? 'Las notificaciones push están configuradas correctamente en tu celular. Recibirás alertas cuando estén disponibles.'
    : 'El token de notificaciones push no está configurado. Verifica los permisos de notificaciones en la configuración de la app en tu celular.';
  
  alert(`🔔 Estado de Notificaciones Push\n\n${status}\n\n${message}`);
  this.addActivityLog('info', 'Consultado estado de permisos push móvil');
}
```

**Rationale:** Removes browser-centric test functions that don't apply to mobile app safety features. Replaces them with mobile-specific informational buttons that show backend data about the mobile device.

**Verify:**
```bash
npm run build && npm start
```
Navigate to `/dashboard/device`, "Pruebas de Funcionalidad" panel. Expected: 3 buttons: "Ver Ubicación Móvil", "Ver Permisos Push Móvil", "Probar Conectividad". Clicking the first two shows alerts with mobile device data. The third tests web connectivity.

- [ ] **9. Replace hardcoded purple color with design token in device.scss**

Change `.device-btn--primario` and `.device-action-btn` backgrounds from `#380759` to `var(--color-acento)`.

**Files:**
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/device/device.scss`

**Changes:**

In `device.scss` (around line 70), update `.device-btn--primario`:

```scss
&--primario {
  background: var(--color-acento);  // was #380759
  color: #fff;
}
```

In `device.scss` (around line 437), update `.device-action-btn`:

```scss
.device-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 1rem;
  border-radius: 12px;
  background: var(--color-acento);  // was #380759
  border: none;
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;

  i { font-size: 1.1rem; }

  &:hover:not(:disabled) { opacity: 0.92; }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
```

**Rationale:** Use design tokens instead of magic colors for maintainability and theme consistency.

**Verify:**
```bash
npm run build
```
Expected: Build succeeds. Buttons use the theme's accent color (which maps to `--purple-deep`).

---

## Module 3: SETTINGS — Remove Security Card, Add Missing Colors, Clarify Labels

### Background
The Settings module has a "Seguridad" card with features (app lock, biometric auth, auto-lock time) that don't apply to the web dashboard. The user wants this card removed. Also, "Tamaño de letra" should be removed from Apariencia (not implemented in the mobile app), missing theme colors added, and "Personalización de datos" label clarified.

- [ ] **10. Remove 'Seguridad' card and related signals/methods from Settings**

Delete the entire "Seguridad" card from `settings.html` and remove associated state and methods from `settings.ts`.

**Files:**
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/settings/settings.html`
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/settings/settings.ts`

**Changes:**

In `settings.html` (around lines 100-155), delete the entire `<!-- SEGURIDAD -->` article block:

```html
<!-- SEGURIDAD -->
<article class="settings-card">
  ...entire block...
</article>
```

In `settings.ts` (around lines 59-62), remove these signals:

```typescript
readonly appLockActive = signal(true);
readonly biometricAuth = signal(true);
readonly autoLockTime = signal('5 minutos');
```

In `settings.ts` (around line 88), remove `toggleBiometricAuth()` method:

```typescript
toggleBiometricAuth(): void {
  this.biometricAuth.update(v => !v);
}
```

**Rationale:** The security features (app lock, biometric auth, auto-lock) are mobile app features, not web dashboard features. Removing them eliminates confusion.

**Verify:**
```bash
npm run build
```
Expected: Build succeeds with no errors. "Seguridad" card does not appear in the settings page.

- [ ] **11. Remove 'Tamaño de letra' section from Apariencia card in Settings**

Delete the font size selection UI from the Apariencia card and remove related state from `settings.ts`.

**Files:**
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/settings/settings.html`
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/settings/settings.ts`
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/settings/settings.scss`

**Changes:**

In `settings.html` (around lines 71-84), delete the "Tamaño de letra" section:

```html
<p class="settings-card__label">Tamaño de letra</p>
<div class="font-size-options">
  @for (size of fontSizes; track size) {
    ...entire block...
  }
</div>
```

In `settings.ts` (around lines 48-50), remove:

```typescript
readonly fontSizes: FontSize[] = ['pequeña', 'normal', 'grande'];
readonly selectedFontSize = signal<FontSize>('normal');
```

In `settings.ts` (around line 7), remove the `FontSize` type definition:

```typescript
type FontSize = 'pequeña' | 'normal' | 'grande';
```

In `settings.ts` (around lines 73-77), remove `selectFontSize()` method:

```typescript
selectFontSize(size: FontSize): void {
  this.selectedFontSize.set(size);
  document.documentElement.setAttribute('data-font-size', size);
  // TODO: aplicar clase/variable global de tamaño de fuente en styles.scss
}
```

In `settings.scss` (around lines 193-223), remove these style blocks:

```scss
// --- Tamaño de letra ---
.font-size-options {
  ...entire block...
}

.font-size-option {
  ...entire block...
}
```

**Rationale:** Font size adjustment is not implemented in the mobile app and removing it from the web dashboard avoids feature mismatch.

**Verify:**
```bash
npm run build
```
Expected: Build succeeds. "Tamaño de letra" section no longer appears in Apariencia card.

- [ ] **12. Clarify 'Personalización de datos' description in Privacidad card**

Update the description text to explain what data personalization controls.

**Files:**
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/settings/settings.html`

**Changes:**

In `settings.html` (around line 132), update the setting row description:

```html
<button type="button" class="setting-row setting-row--link">
  <div>
    <strong>Personalización de datos</strong>
    <span>Gestiona qué datos personales se sincronizan con el backend (nombre, teléfono, foto de perfil).</span>
  </div>
  <i class="ti ti-chevron-right"></i>
</button>
```

**Rationale:** The original text "Controla qué información compartes" was vague. The new text explicitly states what data is controlled (personal data sync).

**Verify:**
```bash
npm run build && npm start
```
Navigate to `/dashboard/ajustes`, Privacidad card. Expected: "Personalización de datos" row shows the updated, clearer description.

- [ ] **13. Add missing theme colors to Apariencia in Settings**

Add missing colors from the mobile app palette to the `accentColors` array, and fix the incorrect "rosa" name (should be "azulOscuro").

**Files:**
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/settings/settings.ts`

**Changes:**

In `settings.ts` (around lines 42-46), update `accentColors`:

```typescript
readonly accentColors: AccentColor[] = [
  { name: 'purpura', value: '#7c3aed' },       // primary violet (unchanged)
  { name: 'azulOscuro', value: '#130253' },    // dark blue (was incorrectly named 'rosa')
  { name: 'magenta', value: '#710592' },       // magenta (unchanged)
  { name: 'rosa', value: '#ec4899' },          // NEW: pink
  { name: 'celeste', value: '#0891b2' },       // NEW: teal/accent
  { name: 'rojo', value: '#ef4444' },          // NEW: red/danger
];
```

**Rationale:** The mobile app uses these colors. The web dashboard should offer the same palette for consistency. The second entry was misnamed "rosa" when it's actually dark blue (#130253).

**Verify:**
```bash
npm run build && npm start
```
Navigate to `/dashboard/ajustes`, Apariencia card. Expected: 6 color swatches appear (purpura, azulOscuro, magenta, rosa, celeste, rojo). Clicking each changes the accent color.

- [ ] **14. Add 'Emergencia' settings card with contacts info row**

Insert a new "Emergencia" card between Privacidad and Soporte with a read-only info row about emergency contacts.

**Files:**
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/settings/settings.html`

**Changes:**

In `settings.html`, after the Privacidad card closing `</article>` tag (around line 149) and before the Soporte card, insert:

```html
<!-- EMERGENCIA -->
<article class="settings-card">
  <div class="settings-card__header">
    <h2><i class="ti ti-alert-triangle"></i> Emergencia</h2>
  </div>

  <button type="button" class="setting-row setting-row--link">
    <div>
      <strong>Contactos de emergencia</strong>
      <span>Agrega o edita tus contactos de confianza desde la app móvil.</span>
    </div>
    <i class="ti ti-chevron-right"></i>
  </button>

  <div class="settings-card__banner">
    <i class="ti ti-info-circle"></i>
    <div>
      <strong>Gestión desde la app móvil</strong>
      <span>Los contactos de emergencia se administran desde la aplicación en tu celular, donde puedes agregarlos, editarlos y activarlos para recibir alertas.</span>
    </div>
  </div>
</article>
```

**Rationale:** Groups emergency-related settings in a dedicated card. Since contacts are managed via the mobile app, this is a read-only informational row in the web dashboard.

**Verify:**
```bash
npm run build && npm start
```
Navigate to `/dashboard/ajustes`. Expected: New "Emergencia" card appears between Privacidad and Soporte, with one row ("Contactos de emergencia") and an informational banner.

- [ ] **15. Remove 'Tamaño de letra' footer item from Settings footer**

Delete the footer item with the `ti-text-size` icon.

**Files:**
- `/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web/src/app/features/dashboard/settings/settings.html`

**Changes:**

In `settings.html` (around lines 215-221), delete the footer item:

```html
<div class="footer-item">
  <i class="ti ti-text-size"></i>
  <div>
    <strong>Tamaño de letra</strong>
    <span>Mejora la legibilidad.</span>
  </div>
</div>
```

**Rationale:** Since font size adjustment was removed from the Apariencia card, the footer reference to it should also be removed.

**Verify:**
```bash
npm run build
```
Expected: Build succeeds. Footer no longer shows "Tamaño de letra" item.

---

## Final Verification

After completing all 15 steps above, run the full project build and manual testing:

**Build verification:**
```bash
cd "/home/maicol/Documentos/proyecto /Frond-end-Web/alerta-mujer-web"
npm run build
```

Expected: Production build completes with no TypeScript errors or warnings (aside from bundle size warnings, which are acceptable per angular.json config).

**Manual testing:**
```bash
npm start
```

1. Navigate to `/dashboard/asistencia`:
   - Verify category colors match the violet/purple palette
   - Verify call buttons are violet (not green)
   - Go to "Centros de atención", enable location, check user pin is violet (not indigo)

2. Navigate to `/dashboard/device`:
   - Verify page title is "Estado del Dispositivo Móvil"
   - Verify "Permisos del Celular (App Móvil)" panel with greyed-out items
   - Verify "Dispositivo Móvil Vinculado" panel shows mobile device data (or empty state)
   - Verify "Estado de Servicios" shows mobile-centric services
   - Verify "Pruebas de Funcionalidad" has 3 buttons (Ver Ubicación Móvil, Ver Permisos Push Móvil, Probar Conectividad)

3. Navigate to `/dashboard/ajustes`:
   - Verify "Seguridad" card is removed
   - Verify "Apariencia" card has no "Tamaño de letra" section
   - Verify "Apariencia" card has 6 color swatches (purpura, azulOscuro, magenta, rosa, celeste, rojo)
   - Verify "Privacidad" card has clarified "Personalización de datos" text
   - Verify "Emergencia" card appears between Privacidad and Soporte
   - Verify footer has no "Tamaño de letra" item

**Test execution:**
```bash
npm test
```

Expected: Existing unit tests pass. If any tests fail due to removed signals/methods (e.g., tests for `appLockActive`, `biometricAuth`, `selectFontSize`), those tests should also be removed or updated.

---

## Summary

This plan makes three coordinated changes:

1. **Assistance module:** Aligns category colors and UI elements (call button, user pin) with the violet/purple brand palette, replacing amber, blue, green, and indigo with violet/teal.

2. **Device module:** Refocuses the entire module from browser/laptop diagnostics to mobile device status, replacing browser info with backend mobile device data and removing browser-centric test functions.

3. **Settings module:** Removes the "Seguridad" card (not applicable to web dashboard), removes "Tamaño de letra" (not implemented), adds missing theme colors, clarifies "Personalización de datos", and adds an "Emergencia" card linking to mobile app contact management.

All changes leave the codebase in a buildable, runnable state after each step. No backend API changes are required — all changes are frontend-only, using existing services and data structures.
