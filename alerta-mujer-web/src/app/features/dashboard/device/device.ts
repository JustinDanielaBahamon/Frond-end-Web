import { Component, OnInit, OnDestroy, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, Subject, Subscription, catchError, finalize, forkJoin, map, of, takeUntil } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { DeviceInfoService } from '../../../core/services/device-info.service';
import { PermissionsService } from '../../../core/services/permissions.service';
import { DeviceService, UserDevice } from '../../../core/services/device.service';
import { EmergencyContactService } from '../../../core/services/emergency-contact.service';
import { PhoneLocationService } from '../../../core/services/phone.location.services';
import { AuthService } from '../../../core/auth/auth.service';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { LocationEntry } from '../../../core/models/location.model';
import {
  DeviceInfo,
  ServiceStatus,
  ActivityLog,
  CriticalFeatureStatus
} from '../../../core/models/device-info.model';

interface DeviceDetail {
  title: string;
  subtitle: string;
  icon: string;
  rows: { label: string; value: string }[];
  nota?: string;
  /** Color del encabezado en los resultados de las pruebas. */
  tone?: 'ok' | 'aviso' | 'error';
  /** url: enlace externo; ruta: pantalla de esta misma web (se abre aquí, sin pestaña nueva). */
  link?: { url?: string; route?: string; text: string };
}

/** Permisos que informa la app (ver reportarPermisos en la app móvil). */
const PHONE_PERMISSIONS = [
  { id: 'ubicacion', title: 'Ubicación', description: 'Para enviar dónde estás en una alerta', icon: 'ti-map-pin' },
  { id: 'notificaciones', title: 'Notificaciones', description: 'Para recibir las alertas de tus contactos', icon: 'ti-bell' },
  { id: 'agitar', title: 'Métodos de activación', description: 'Agitar el celular para enviar una alerta', icon: 'ti-hand-move' },
  { id: 'bateria', title: 'Batería sin restricciones', description: 'Para que el teléfono no apague la protección', icon: 'ti-battery-charging' },
  { id: 'microfono', title: 'Micrófono', description: 'Para grabar audio como evidencia', icon: 'ti-microphone' },
  { id: 'camara', title: 'Cámara', description: 'Para grabar video como evidencia', icon: 'ti-camera' },
];

const SHORT_DATE: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };

const GPS_STATUSES: Record<string, string> = {
  active: 'Activo', inactive: 'Apagado', denied: 'Permiso denegado', unknown: 'Sin dato',
};
const DEVICE_STATUSES: Record<string, string> = {
  active: 'Activo', inactive: 'Inactivo', blocked: 'Bloqueado', lost: 'Reportado como perdido',
};

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
  private deviceService = inject(DeviceService);
  private contactService = inject(EmergencyContactService);
  private locationService = inject(PhoneLocationService);
  private authService = inject(AuthService);
  private geocoding = inject(GeocodingService);

  // Estado reactivo con signals
  deviceInfo = signal<DeviceInfo | null>(null);
  services = signal<ServiceStatus[]>([]);
  isOnline = signal<boolean>(true);
  connectionQuality = signal<string>('Desconocida');
  criticalFeatures = signal<CriticalFeatureStatus | null>(null);
  activityLog = signal<ActivityLog[]>([]);
  /** Celulares en los que la usuaria inició sesión con la app móvil. */
  myPhones = signal<UserDevice[]>([]);
  /** Ventana con el detalle de un dispositivo (celular o este computador). */
  detail = signal<DeviceDetail | null>(null);

  /** Permisos del celular usado más recientemente, tal como los informó la app. */
  phonePermissions = computed(() => {
    const celular = [...this.myPhones()]
      .filter((d) => !!d.permissions)
      .sort((a, b) => (b.permissionsUpdatedAt ?? '').localeCompare(a.permissionsUpdatedAt ?? ''))[0];
    if (!celular?.permissions) return null;
    let data: Record<string, boolean>;
    try {
      data = JSON.parse(celular.permissions);
    } catch {
      return null;
    }
    const list = PHONE_PERMISSIONS.filter((p) => p.id in data).map((p) => ({ ...p, granted: data[p.id] === true }));
    return {
      list,
      missing: list.filter((p) => !p.granted).length,
      celular: this.phoneName(celular),
      updated: celular.permissionsUpdatedAt
        ? new Date(celular.permissionsUpdatedAt).toLocaleString('es-CO', SHORT_DATE)
        : 'sin fecha',
    };
  });

  /** Celular usado más recientemente: de él se toma la ubicación del día a día. */
  principalId = computed(() => {
    const celulares = this.myPhones().filter((d) => d.osName !== 'web');
    if (celulares.length === 0) return null;
    return [...celulares].sort((a, b) => (b.lastAccess ?? '').localeCompare(a.lastAccess ?? ''))[0].id;
  });

  /** Tiempo que le queda a la sesión de la web ("5 h 20 min"). */
  sessionRemaining = signal('');
  sessionExpiring = signal(false);
  private sessionClock?: ReturnType<typeof setInterval>;

  lastRefresh = signal<string>('');
  loading = signal<boolean>(false);
  featuresLoading = signal<boolean>(false);

  private currentUserId: number | null = null;
  private featuresSub?: Subscription;

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    // Subscribe to current user to get user ID for scoped logging
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUserId = user?.id || null;
        
        // Load user-scoped data only after user ID is available
        if (this.currentUserId) {
          this.loadCriticalFeatures();
          this.loadActivityLog();
        }
      });

    this.loadDeviceInfo();
    this.loadServices();
    this.refreshSession();
    this.sessionClock = setInterval(() => this.refreshSession(), 30000);
    this.subscribeToOnlineStatus();
    this.updateLastRefresh();
  }

  private loadDeviceInfo(): void {
    try {
      const info = this.deviceInfoService.getDeviceInfo();
      this.deviceInfo.set(info);
    } catch (error) {
      console.error('Error loading device info:', error);
    }
  }

  private refreshSession(): void {
    const ms = this.authService.remainingTimeMs();
    if (ms === null) {
      this.sessionRemaining.set('Sin sesión');
      this.sessionExpiring.set(true);
      return;
    }
    const minutos = Math.floor(ms / 60000);
    const hours = Math.floor(minutos / 60);
    this.sessionRemaining.set(hours > 0 ? `${hours} h ${minutos % 60} min` : `${minutos} min`);
    this.sessionExpiring.set(minutos < 60);
  }

  private loadServices(): void {
    const services: ServiceStatus[] = [
      {
        name: 'Celular Vinculado',
        enabled: false,
        details: 'Se actualiza al sincronizar'
      },
      {
        name: 'Recibe alertas en el celular',
        enabled: false,
        details: 'Tus contactos te pueden avisar al celular'
      },
      {
        name: 'Última Ubicación Registrada',
        enabled: false,
        details: 'Ubicación reportada por la app móvil'
      },
      {
        name: 'Conectividad',
        enabled: navigator.onLine,
        details: 'Conexión a internet activa'
      }
    ];

    this.services.set(services);
    this.connectionQuality.set(this.deviceInfoService.getConnectionQuality());
  }

  private loadCriticalFeatures(): void {
    this.featuresSub?.unsubscribe();
    this.featuresSub = this.fetchCriticalFeatures().subscribe(() => this.updateMobileServices());
  }

  /**
   * Consulta en el backend los contactos, los celulares vinculados y la última
   * ubicación enviada por la app móvil. Emite false si alguna consulta falló.
   */
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

    // Cada consulta falla por separado: null = error (204 de "sin ubicación" llega como null válido)
    const FAILED = 'failed' as const;
    return forkJoin({
      contacts: this.contactService.getByUser(userId).pipe(catchError(() => of(null))),
      devices: this.deviceService.getMyDevices().pipe(catchError(() => of(null))),
      latest: this.locationService.getLatest().pipe(catchError(() => of(FAILED)))
    }).pipe(
      map(({ contacts, devices, latest }) => {
        if (devices) this.myPhones.set(devices);
        this.criticalFeatures.set({
          sessionActive: this.authService.isLoggedIn(),
          lastLocationCaptured: latest === FAILED ? 'No disponible' : latest ? this.formatLocation(latest) : null,
          registeredDevices: devices ? devices.length : null,
          pushTokenRegistered: !!devices?.some(d => !!d.fcmToken),
          emergencyContactsCount: contacts ? contacts.length : null
        });
        if (latest && latest !== FAILED) this.resolveAddress(latest);
        this.ultimaUbicacion = latest && latest !== FAILED ? latest : null;
        return contacts !== null && devices !== null && latest !== FAILED;
      }),
      finalize(() => this.featuresLoading.set(false)),
      takeUntil(this.destroy$)
    );
  }

  /** Última ubicación que envió la app del celular (no la del computador). */
  private ultimaUbicacion: LocationEntry | null = null;
  private lastAddress: string | null = null;

  private locationDate(entry: LocationEntry): string {
    return entry.recordedAt ? new Date(entry.recordedAt).toLocaleString('es-CO', SHORT_DATE) : entry.time;
  }

  private formatLocation(entry: LocationEntry): string {
    return `${this.lastAddress ?? 'Buscando la dirección…'} · ${this.locationDate(entry)}`;
  }

  /** Cambia las coordenadas por barrio y dirección (OpenStreetMap, igual que en la app). */
  private resolveAddress(entry: LocationEntry): void {
    this.geocoding.get(entry.lat, entry.lng).then((place) => {
      const text = place ? [place.neighborhood, place.address].filter(Boolean).join(' · ') || place.city : null;
      this.lastAddress = text ?? `${entry.lat.toFixed(5)}, ${entry.lng.toFixed(5)}`;
      const actual = this.criticalFeatures();
      if (actual) this.criticalFeatures.set({ ...actual, lastLocationCaptured: this.formatLocation(entry) });
    });
  }

  private updateMobileServices(): void {
    const features = this.criticalFeatures();
    if (!features) return;

    this.updateServiceStatus('Celular Vinculado', (features.registeredDevices ?? 0) > 0);
    this.updateServiceStatus('Recibe alertas en el celular', features.pushTokenRegistered);
    this.updateServiceStatus('Última Ubicación Registrada', 
      features.lastLocationCaptured !== null && features.lastLocationCaptured !== 'No disponible');
  }

  phoneName(d: UserDevice): string {
    if (d.deviceName) return d.deviceName;
    const nombre = [d.brand, d.model].filter(Boolean).join(' ');
    return nombre || 'Celular sin nombre';
  }

  /** "Chrome 130 en Linux" */
  computerName(): string {
    const i = this.deviceInfo();
    return i ? `${i.browser} en ${i.os}` : 'Este navegador';
  }

  openPhone(d: UserDevice): void {
    const fecha = (iso?: string | null) => iso
      ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Sin registro';
    this.detail.set({
      title: this.phoneName(d),
      subtitle: [d.brand, d.model].filter(Boolean).join(' ') || 'Celular con la app AlertaMujer',
      icon: 'ti-device-mobile',
      rows: [
        { label: 'Nombre del celular', value: d.deviceName || 'No informado' },
        { label: 'Marca', value: d.brand || 'No informada' },
        { label: 'Modelo', value: d.model || 'No informado' },
        { label: 'Sistema', value: `${d.osName === 'ios' ? 'iOS' : 'Android'}${d.osVersion ? ' ' + d.osVersion : ''}` },
        { label: 'Versión de la app', value: d.appVersion || 'No informada' },
        { label: 'Recibe alertas (push)', value: d.fcmToken ? 'Sí' : 'No' },
        { label: 'GPS', value: GPS_STATUSES[d.gpsStatus] ?? d.gpsStatus },
        { label: 'Estado', value: DEVICE_STATUSES[d.status] ?? d.status },
        { label: 'Última conexión', value: fecha(d.lastAccess) },
        { label: 'Vinculado desde', value: fecha(d.createdAt) },
      ],
      nota: d.model === 'Dispositivo Expo'
        ? 'Este celular se registró con una versión anterior de la app. Sus datos se completan la próxima vez que abras la app actualizada.'
        : undefined,
    });
  }

  openComputer(): void {
    const i = this.deviceInfo();
    const screen = this.deviceInfoService.getScreenInfo();
    const nav = navigator as Navigator & { deviceMemory?: number };
    this.detail.set({
      title: 'Este computador',
      subtitle: this.computerName(),
      icon: 'ti-device-desktop',
      rows: [
        { label: 'Navegador', value: i ? `${i.browser} ${i.version}` : 'Desconocido' },
        { label: 'Sistema operativo', value: i?.os ?? 'Desconocido' },
        { label: 'Pantalla', value: `${screen.width} × ${screen.height} px (escala ${screen.dpr})` },
        { label: 'Procesador', value: navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} núcleos` : 'Sin dato' },
        { label: 'Memoria', value: nav.deviceMemory ? `${nav.deviceMemory} GB aprox.` : 'Sin dato' },
        { label: 'Idioma', value: i?.language ?? navigator.language },
        { label: 'Zona horaria', value: i?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone },
        { label: 'Conexión', value: `${this.isOnline() ? 'En línea' : 'Sin conexión'} · ${this.connectionQuality()}` },
      ],
      nota: 'El computador solo sirve para consultar tu información. Las alertas se activan y se reciben en el celular con la app.',
    });
  }

  closeDetail(): void {
    this.detail.set(null);
  }

  lastConnection(d: UserDevice): string {
    if (!d.lastAccess) return 'Sin registro';
    return new Date(d.lastAccess).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  pushStatusLabel(features: CriticalFeatureStatus): string {
    if (features.pushTokenRegistered) return 'Configurado';
    if (features.registeredDevices === null) return 'No disponible';
    if (features.registeredDevices === 0) return 'Sin celular vinculado';
    return 'No configurado';
  }

  private loadActivityLog(): void {
    try {
      const userId = this.currentUserId;
      if (!userId) {
        this.activityLog.set([]);
        return;
      }
      
      // Scope activity logs by user ID to prevent cross-user leaks (snake_case for consistency)
      const logKey = `device_activity_log_user_${userId}`;
      const stored = localStorage.getItem(logKey);
      if (stored) {
        const logs = JSON.parse(stored);
        this.activityLog.set(Array.isArray(logs) ? logs.slice(0, 5) : []);
      }
    } catch (error) {
      console.error('Error loading activity log:', error);
    }
  }

  private subscribeToOnlineStatus(): void {
    this.deviceInfoService.isOnline()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (online) => {
          this.isOnline.set(online);
          this.updateServiceStatus('Conectividad', online);
        }
      });
  }

  private updateServiceStatus(name: string, enabled: boolean): void {
    const services = this.services();
    const index = services.findIndex(s => s.name === name);
    if (index !== -1) {
      services[index].enabled = enabled;
      this.services.set([...services]);
    }
  }

  private updateLastRefresh(): void {
    const now = new Date();
    this.lastRefresh.set(now.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }));
  }

  // ─── PRUEBAS DE FUNCIONALIDAD (el resultado sale en una tarjeta, no en el aviso del navegador) ───

  private showResult(r: Omit<DeviceDetail, 'rows'> & { rows?: DeviceDetail['rows'] }): void {
    this.detail.set({ rows: [], ...r });
  }

  viewMobileLocation(): void {
    const u = this.ultimaUbicacion;
    if (!u) {
      this.showResult({
        title: 'Sin ubicación del celular',
        subtitle: 'La app todavía no ha enviado tu ubicación',
        icon: 'ti-map-pin-off',
        tone: 'aviso',
        nota: 'Abre AlertaMujer en tu celular con la ubicación activada y vuelve a intentarlo.',
      });
      return;
    }
    this.showResult({
      title: 'Tu celular está aquí',
      subtitle: 'Última ubicación que envió la app del celular',
      icon: 'ti-map-pin',
      tone: 'ok',
      rows: [
        { label: 'Dirección', value: this.lastAddress ?? 'Buscando la dirección…' },
        { label: 'Fecha y hora', value: this.locationDate(u) },
      ],
      // Se abre en el mapa de AlertaMujer (Mi ubicación), no en Google Maps
      link: { route: '/dashboard/ubicacion/my-location', text: 'Ver en mi mapa' },
    });
  }

  testPhoneAlerts(): void {
    const celulares = this.myPhones();
    const conPush = celulares.filter((d) => !!d.fcmToken);
    if (celulares.length === 0) {
      this.showResult({
        title: 'No tienes un celular vinculado',
        subtitle: 'Las alertas se reciben en la app del celular',
        icon: 'ti-device-mobile-off',
        tone: 'aviso',
        nota: 'Instala AlertaMujer en tu celular e inicia sesión con esta cuenta.',
      });
      return;
    }
    const pc = this.phonePermissions();
    const notifications = pc?.list.find((p) => p.id === 'notificaciones');
    const ok = conPush.length > 0 && notifications?.granted !== false;
    this.showResult({
      title: ok ? 'Tu celular recibe alertas' : 'Tu celular no recibe alertas',
      subtitle: ok
        ? 'Si un contacto activa una alerta, sonará una alarma en tu celular'
        : 'Si un contacto activa una alerta, no te llegará al celular',
      icon: ok ? 'ti-bell-check' : 'ti-bell-off',
      tone: ok ? 'ok' : 'error',
      rows: celulares.map((d) => ({ label: this.phoneName(d), value: d.fcmToken ? 'Recibe alertas' : 'No recibe alertas' })),
      nota: ok ? undefined : 'Abre la app en tu celular y permite las notificaciones cuando te lo pida.',
    });
  }

  requestNotificationPermission(): void {
    if (!('Notification' in window)) {
      this.showResult({
        title: 'Este navegador no muestra avisos',
        subtitle: 'Usa Chrome, Edge o Firefox para recibir avisos en el computador',
        icon: 'ti-bell-off',
        tone: 'aviso',
      });
      return;
    }

    this.permissionsService.requestNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (permission) => {
          if (permission === 'granted') {
            new Notification('AlertaMujer', { body: 'Así te avisaremos en este computador cuando un contacto active una alerta.', icon: '/email/logo.png' });
            this.showResult({
              title: 'Los avisos funcionan',
              subtitle: 'Te enviamos un aviso de prueba a este computador',
              icon: 'ti-bell-ringing',
              tone: 'ok',
            });
            this.addActivityLog('success', 'Avisos del computador activados');
          } else {
            this.showResult({
              title: 'Los avisos están bloqueados',
              subtitle: 'No te llegarán avisos en este computador',
              icon: 'ti-bell-off',
              tone: 'aviso',
              nota: 'Toca el candado junto a la dirección de la página, busca «Notificaciones» y elige «Permitir».',
            });
            this.addActivityLog('warning', 'Avisos del computador bloqueados');
          }
        },
        error: () => this.showResult({ title: 'No se pudo probar', subtitle: 'Intenta de nuevo', icon: 'ti-alert-circle', tone: 'error' }),
      });
  }

  testConnectivity(): void {
    const startTime = Date.now();
    this.loading.set(true);

    // /health es público. En el plan gratis de Render la primera petición despierta el servidor y
    // puede tardar; se espera hasta 90 s.
    fetch(`${environment.apiUrl}/health`, { method: 'GET', signal: AbortSignal.timeout(90000) })
      .then(response => {
        const duration = Date.now() - startTime;
        const segundos = (duration / 1000).toFixed(1);
        if (response.ok) {
          this.showResult({
            title: 'Conexión correcta',
            subtitle: 'El servidor de AlertaMujer responde',
            icon: 'ti-wifi',
            tone: 'ok',
            rows: [{ label: 'Tiempo de respuesta', value: `${segundos} s` }],
            nota: duration > 10000 ? 'El servidor estaba en reposo y tardó en despertar.' : undefined,
          });
          this.addActivityLog('success', `Conexión con el servidor correcta (${segundos} s)`);
        } else {
          this.showResult({
            title: 'El servidor tiene un problema',
            subtitle: 'Respondió con un error',
            icon: 'ti-server-off',
            tone: 'error',
            rows: [{ label: 'Código', value: String(response.status) }],
          });
          this.addActivityLog('warning', `El servidor respondió con error ${response.status}`);
        }
      })
      .catch(() => {
        this.showResult({
          title: navigator.onLine ? 'El servidor no responde' : 'Sin internet',
          subtitle: navigator.onLine ? 'Tu internet funciona, pero el servidor no contestó' : 'Revisa tu conexión a internet',
          icon: 'ti-wifi-off',
          tone: 'error',
          nota: navigator.onLine ? 'Si estaba en reposo puede tardar hasta 3 minutos en despertar: intenta de nuevo en un momento.' : undefined,
        });
        this.addActivityLog('error', 'No hubo conexión con el servidor');
      })
      .finally(() => this.loading.set(false));
  }

  // ─── ACCIONES RÁPIDAS ─────────────────

  syncData(): void {
    this.loading.set(true);
    this.featuresSub?.unsubscribe();
    this.featuresSub = this.fetchCriticalFeatures()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(ok => {
        this.updateMobileServices();
        this.updateLastRefresh();
        if (ok) {
          const f = this.criticalFeatures();
          this.showResult({
            title: 'Datos actualizados',
            subtitle: 'Se trajo la información más reciente del servidor',
            icon: 'ti-refresh',
            tone: 'ok',
            rows: [
              { label: 'Celulares vinculados', value: String(this.myPhones().length) },
              { label: 'Contactos de emergencia', value: String(f?.emergencyContactsCount ?? 0) },
              { label: 'Última ubicación', value: f?.lastLocationCaptured ?? 'No registrada' },
            ],
          });
          this.addActivityLog('success', 'Datos sincronizados con el servidor');
        } else {
          this.showResult({
            title: 'No se pudo actualizar todo',
            subtitle: 'El servidor no respondió a tiempo',
            icon: 'ti-refresh-alert',
            tone: 'aviso',
            nota: 'Intenta de nuevo en un momento.',
          });
          this.addActivityLog('warning', 'Sincronización incompleta: el servidor no respondió');
        }
      });
  }

  clearCache(): void {
    const confirmClear = confirm('¿Limpiar los datos temporales de la web? No se cierra tu sesión ni se borran tus contactos.');
    if (!confirmClear) return;
    try {
      // Se conservan la sesión (AuthService usa 'alerta_session') y los datos de la usuaria
      const keysToKeep = [
        'alerta_session',
        'user_data',
        'emergency_contacts',
        'emergency_contacts_user_',
        'notification_token_user_',
        'last_location_user_',
        'device_activity_log_user_'
      ];
      let clearedCount = 0;
      Object.keys(localStorage).forEach(key => {
        if (!keysToKeep.some(pattern => key.includes(pattern))) {
          localStorage.removeItem(key);
          clearedCount++;
        }
      });
      this.showResult({
        title: 'Caché limpiada',
        subtitle: `${clearedCount} ${clearedCount === 1 ? 'dato temporal eliminado' : 'datos temporales eliminados'}`,
        icon: 'ti-trash',
        tone: 'ok',
      });
      this.addActivityLog('success', `Caché limpiada: ${clearedCount} elementos`);
      this.loadCriticalFeatures();
    } catch {
      this.showResult({ title: 'No se pudo limpiar la caché', subtitle: 'Intenta de nuevo', icon: 'ti-alert-circle', tone: 'error' });
    }
  }

  /** Vuelve a consultar los permisos que informó el celular y el estado de los servicios. */
  refreshPermissions(): void {
    this.loading.set(true);
    this.loadServices();
    this.refreshSession();
    this.featuresSub?.unsubscribe();
    this.featuresSub = this.fetchCriticalFeatures()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(() => {
        this.updateMobileServices();
        this.updateLastRefresh();
        const pc = this.phonePermissions();
        this.addActivityLog('info', pc
          ? `Permisos revisados: ${pc.list.length - pc.missing} de ${pc.list.length} listos`
          : 'Permisos revisados: el celular aún no los informa');
      });
  }

  refreshAll(): void {
    this.refreshPermissions();
  }

  // ─── MÉTODOS AUXILIARES ─────────────────

  private addActivityLog(type: ActivityLog['type'], message: string): void {
    const userId = this.currentUserId;
    if (!userId) {
      console.warn('Cannot log activity: no user session');
      return;
    }

    const log: ActivityLog = {
      timestamp: new Date().toLocaleString('es-ES'),
      type,
      message
    };

    const currentLogs = this.activityLog();
    const newLogs = [log, ...currentLogs].slice(0, 5);
    this.activityLog.set(newLogs);

    try {
      // Scope activity log by user ID with snake_case naming for consistency
      const logKey = `device_activity_log_user_${userId}`;
      localStorage.setItem(logKey, JSON.stringify(newLogs));
    } catch (error) {
      console.error('Error saving activity log:', error);
    }
  }

  getStatusColor(state: string): string {
    const colorMap: Record<string, string> = {
      'granted': 'exito',
      'denied': 'peligro',
      'prompt': 'advertencia',
      'unavailable': 'neutral'
    };
    return colorMap[state] || 'neutral';
  }

  getStatusLabel(state: string): string {
    const labelMap: Record<string, string> = {
      'granted': 'Concedido',
      'denied': 'Denegado',
      'prompt': 'Pendiente',
      'unavailable': 'No disponible'
    };
    return labelMap[state] || 'Desconocido';
  }

  getIconForPermission(name: string): string {
    const iconMap: Record<string, string> = {
      'geolocation': 'ti-map-pin',
      'notifications': 'ti-bell',
      'camera': 'ti-camera',
      'microphone': 'ti-microphone',
      'clipboard-read': 'ti-clipboard'
    };
    return iconMap[name] || 'ti-shield-check';
  }

  getIconForActivityType(type: string): string {
    const iconMap: Record<string, string> = {
      'info': 'ti-info-circle',
      'warning': 'ti-alert-triangle',
      'error': 'ti-x-circle',
      'success': 'ti-check-circle'
    };
    return iconMap[type] || 'ti-info-circle';
  }

  ngOnDestroy(): void {
    if (this.sessionClock) clearInterval(this.sessionClock);
    this.destroy$.next();
    this.destroy$.complete();
  }
}
