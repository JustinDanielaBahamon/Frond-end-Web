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
import { UbicacionEntry } from '../../../core/models/location.model';
import {
  DeviceInfo,
  ServiceStatus,
  ActivityLog,
  CriticalFeatureStatus
} from '../../../core/models/device-info.model';

interface DetalleDispositivo {
  titulo: string;
  subtitulo: string;
  icono: string;
  filas: { etiqueta: string; valor: string }[];
  nota?: string;
  /** Color del encabezado en los resultados de las pruebas. */
  tono?: 'ok' | 'aviso' | 'error';
  /** url: enlace externo; ruta: pantalla de esta misma web (se abre aquí, sin pestaña nueva). */
  enlace?: { url?: string; ruta?: string; texto: string };
}

/** Permisos que informa la app (ver reportarPermisos en la app móvil). */
const PERMISOS_CELULAR = [
  { id: 'ubicacion', titulo: 'Ubicación', descripcion: 'Para enviar dónde estás en una alerta', icono: 'ti-map-pin' },
  { id: 'notificaciones', titulo: 'Notificaciones', descripcion: 'Para recibir las alertas de tus contactos', icono: 'ti-bell' },
  { id: 'agitar', titulo: 'Métodos de activación', descripcion: 'Agitar el celular para enviar una alerta', icono: 'ti-hand-move' },
  { id: 'bateria', titulo: 'Batería sin restricciones', descripcion: 'Para que el teléfono no apague la protección', icono: 'ti-battery-charging' },
  { id: 'microfono', titulo: 'Micrófono', descripcion: 'Para grabar audio como evidencia', icono: 'ti-microphone' },
  { id: 'camara', titulo: 'Cámara', descripcion: 'Para grabar video como evidencia', icono: 'ti-camera' },
];

const FECHA_CORTA: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };

const ESTADOS_GPS: Record<string, string> = {
  active: 'Activo', inactive: 'Apagado', denied: 'Permiso denegado', unknown: 'Sin dato',
};
const ESTADOS_DISPOSITIVO: Record<string, string> = {
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
  misCelulares = signal<UserDevice[]>([]);
  /** Ventana con el detalle de un dispositivo (celular o este computador). */
  detalle = signal<DetalleDispositivo | null>(null);

  /** Permisos del celular usado más recientemente, tal como los informó la app. */
  permisosCelular = computed(() => {
    const celular = [...this.misCelulares()]
      .filter((d) => !!d.permissions)
      .sort((a, b) => (b.permissionsUpdatedAt ?? '').localeCompare(a.permissionsUpdatedAt ?? ''))[0];
    if (!celular?.permissions) return null;
    let datos: Record<string, boolean>;
    try {
      datos = JSON.parse(celular.permissions);
    } catch {
      return null;
    }
    const lista = PERMISOS_CELULAR.filter((p) => p.id in datos).map((p) => ({ ...p, concedido: datos[p.id] === true }));
    return {
      lista,
      faltan: lista.filter((p) => !p.concedido).length,
      celular: this.nombreCelular(celular),
      actualizado: celular.permissionsUpdatedAt
        ? new Date(celular.permissionsUpdatedAt).toLocaleString('es-CO', FECHA_CORTA)
        : 'sin fecha',
    };
  });

  /** Celular usado más recientemente: de él se toma la ubicación del día a día. */
  principalId = computed(() => {
    const celulares = this.misCelulares().filter((d) => d.osName !== 'web');
    if (celulares.length === 0) return null;
    return [...celulares].sort((a, b) => (b.lastAccess ?? '').localeCompare(a.lastAccess ?? ''))[0].id;
  });

  /** Tiempo que le queda a la sesión de la web ("5 h 20 min"). */
  sesionRestante = signal('');
  sesionPorVencer = signal(false);
  private relojSesion?: ReturnType<typeof setInterval>;

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
    this.actualizarSesion();
    this.relojSesion = setInterval(() => this.actualizarSesion(), 30000);
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

  private actualizarSesion(): void {
    const ms = this.authService.tiempoRestanteMs();
    if (ms === null) {
      this.sesionRestante.set('Sin sesión');
      this.sesionPorVencer.set(true);
      return;
    }
    const minutos = Math.floor(ms / 60000);
    const horas = Math.floor(minutos / 60);
    this.sesionRestante.set(horas > 0 ? `${horas} h ${minutos % 60} min` : `${minutos} min`);
    this.sesionPorVencer.set(minutos < 60);
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
      contacts: this.contactService.getByUsuario(userId).pipe(catchError(() => of(null))),
      devices: this.deviceService.getMyDevices().pipe(catchError(() => of(null))),
      latest: this.locationService.getLatest().pipe(catchError(() => of(FAILED)))
    }).pipe(
      map(({ contacts, devices, latest }) => {
        if (devices) this.misCelulares.set(devices);
        this.criticalFeatures.set({
          sessionActive: this.authService.isLoggedIn(),
          lastLocationCaptured: latest === FAILED ? 'No disponible' : latest ? this.formatLocation(latest) : null,
          registeredDevices: devices ? devices.length : null,
          pushTokenRegistered: !!devices?.some(d => !!d.fcmToken),
          emergencyContactsCount: contacts ? contacts.length : null
        });
        if (latest && latest !== FAILED) this.resolverDireccion(latest);
        this.ultimaUbicacion = latest && latest !== FAILED ? latest : null;
        return contacts !== null && devices !== null && latest !== FAILED;
      }),
      finalize(() => this.featuresLoading.set(false)),
      takeUntil(this.destroy$)
    );
  }

  /** Última ubicación que envió la app del celular (no la del computador). */
  private ultimaUbicacion: UbicacionEntry | null = null;
  private direccionUltima: string | null = null;

  private fechaUbicacion(entry: UbicacionEntry): string {
    return entry.recordedAt ? new Date(entry.recordedAt).toLocaleString('es-CO', FECHA_CORTA) : entry.time;
  }

  private formatLocation(entry: UbicacionEntry): string {
    return `${this.direccionUltima ?? 'Buscando la dirección…'} · ${this.fechaUbicacion(entry)}`;
  }

  /** Cambia las coordenadas por barrio y dirección (OpenStreetMap, igual que en la app). */
  private resolverDireccion(entry: UbicacionEntry): void {
    this.geocoding.obtener(entry.lat, entry.lng).then((lugar) => {
      const texto = lugar ? [lugar.barrio, lugar.direccion].filter(Boolean).join(' · ') || lugar.ciudad : null;
      this.direccionUltima = texto ?? `${entry.lat.toFixed(5)}, ${entry.lng.toFixed(5)}`;
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

  nombreCelular(d: UserDevice): string {
    if (d.deviceName) return d.deviceName;
    const nombre = [d.brand, d.model].filter(Boolean).join(' ');
    return nombre || 'Celular sin nombre';
  }

  /** "Chrome 130 en Linux" */
  nombreComputador(): string {
    const i = this.deviceInfo();
    return i ? `${i.browser} en ${i.os}` : 'Este navegador';
  }

  abrirCelular(d: UserDevice): void {
    const fecha = (iso?: string | null) => iso
      ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Sin registro';
    this.detalle.set({
      titulo: this.nombreCelular(d),
      subtitulo: [d.brand, d.model].filter(Boolean).join(' ') || 'Celular con la app AlertaMujer',
      icono: 'ti-device-mobile',
      filas: [
        { etiqueta: 'Nombre del celular', valor: d.deviceName || 'No informado' },
        { etiqueta: 'Marca', valor: d.brand || 'No informada' },
        { etiqueta: 'Modelo', valor: d.model || 'No informado' },
        { etiqueta: 'Sistema', valor: `${d.osName === 'ios' ? 'iOS' : 'Android'}${d.osVersion ? ' ' + d.osVersion : ''}` },
        { etiqueta: 'Versión de la app', valor: d.appVersion || 'No informada' },
        { etiqueta: 'Recibe alertas (push)', valor: d.fcmToken ? 'Sí' : 'No' },
        { etiqueta: 'GPS', valor: ESTADOS_GPS[d.gpsStatus] ?? d.gpsStatus },
        { etiqueta: 'Estado', valor: ESTADOS_DISPOSITIVO[d.status] ?? d.status },
        { etiqueta: 'Última conexión', valor: fecha(d.lastAccess) },
        { etiqueta: 'Vinculado desde', valor: fecha(d.createdAt) },
      ],
      nota: d.model === 'Dispositivo Expo'
        ? 'Este celular se registró con una versión anterior de la app. Sus datos se completan la próxima vez que abras la app actualizada.'
        : undefined,
    });
  }

  abrirComputador(): void {
    const i = this.deviceInfo();
    const pantalla = this.deviceInfoService.getScreenInfo();
    const nav = navigator as Navigator & { deviceMemory?: number };
    this.detalle.set({
      titulo: 'Este computador',
      subtitulo: this.nombreComputador(),
      icono: 'ti-device-desktop',
      filas: [
        { etiqueta: 'Navegador', valor: i ? `${i.browser} ${i.version}` : 'Desconocido' },
        { etiqueta: 'Sistema operativo', valor: i?.os ?? 'Desconocido' },
        { etiqueta: 'Pantalla', valor: `${pantalla.width} × ${pantalla.height} px (escala ${pantalla.dpr})` },
        { etiqueta: 'Procesador', valor: navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} núcleos` : 'Sin dato' },
        { etiqueta: 'Memoria', valor: nav.deviceMemory ? `${nav.deviceMemory} GB aprox.` : 'Sin dato' },
        { etiqueta: 'Idioma', valor: i?.language ?? navigator.language },
        { etiqueta: 'Zona horaria', valor: i?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone },
        { etiqueta: 'Conexión', valor: `${this.isOnline() ? 'En línea' : 'Sin conexión'} · ${this.connectionQuality()}` },
      ],
      nota: 'El computador solo sirve para consultar tu información. Las alertas se activan y se reciben en el celular con la app.',
    });
  }

  cerrarDetalle(): void {
    this.detalle.set(null);
  }

  ultimaConexion(d: UserDevice): string {
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

  private mostrarResultado(r: Omit<DetalleDispositivo, 'filas'> & { filas?: DetalleDispositivo['filas'] }): void {
    this.detalle.set({ filas: [], ...r });
  }

  viewMobileLocation(): void {
    const u = this.ultimaUbicacion;
    if (!u) {
      this.mostrarResultado({
        titulo: 'Sin ubicación del celular',
        subtitulo: 'La app todavía no ha enviado tu ubicación',
        icono: 'ti-map-pin-off',
        tono: 'aviso',
        nota: 'Abre AlertaMujer en tu celular con la ubicación activada y vuelve a intentarlo.',
      });
      return;
    }
    this.mostrarResultado({
      titulo: 'Tu celular está aquí',
      subtitulo: 'Última ubicación que envió la app del celular',
      icono: 'ti-map-pin',
      tono: 'ok',
      filas: [
        { etiqueta: 'Dirección', valor: this.direccionUltima ?? 'Buscando la dirección…' },
        { etiqueta: 'Fecha y hora', valor: this.fechaUbicacion(u) },
      ],
      // Se abre en el mapa de AlertaMujer (Mi ubicación), no en Google Maps
      enlace: { ruta: '/dashboard/ubicacion/my-location', texto: 'Ver en mi mapa' },
    });
  }

  probarAlertasCelular(): void {
    const celulares = this.misCelulares();
    const conPush = celulares.filter((d) => !!d.fcmToken);
    if (celulares.length === 0) {
      this.mostrarResultado({
        titulo: 'No tienes un celular vinculado',
        subtitulo: 'Las alertas se reciben en la app del celular',
        icono: 'ti-device-mobile-off',
        tono: 'aviso',
        nota: 'Instala AlertaMujer en tu celular e inicia sesión con esta cuenta.',
      });
      return;
    }
    const pc = this.permisosCelular();
    const notificaciones = pc?.lista.find((p) => p.id === 'notificaciones');
    const ok = conPush.length > 0 && notificaciones?.concedido !== false;
    this.mostrarResultado({
      titulo: ok ? 'Tu celular recibe alertas' : 'Tu celular no recibe alertas',
      subtitulo: ok
        ? 'Si un contacto activa una alerta, sonará una alarma en tu celular'
        : 'Si un contacto activa una alerta, no te llegará al celular',
      icono: ok ? 'ti-bell-check' : 'ti-bell-off',
      tono: ok ? 'ok' : 'error',
      filas: celulares.map((d) => ({ etiqueta: this.nombreCelular(d), valor: d.fcmToken ? 'Recibe alertas' : 'No recibe alertas' })),
      nota: ok ? undefined : 'Abre la app en tu celular y permite las notificaciones cuando te lo pida.',
    });
  }

  requestNotificationPermission(): void {
    if (!('Notification' in window)) {
      this.mostrarResultado({
        titulo: 'Este navegador no muestra avisos',
        subtitulo: 'Usa Chrome, Edge o Firefox para recibir avisos en el computador',
        icono: 'ti-bell-off',
        tono: 'aviso',
      });
      return;
    }

    this.permissionsService.requestNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (permission) => {
          if (permission === 'granted') {
            new Notification('AlertaMujer', { body: 'Así te avisaremos en este computador cuando un contacto active una alerta.', icon: '/email/logo.png' });
            this.mostrarResultado({
              titulo: 'Los avisos funcionan',
              subtitulo: 'Te enviamos un aviso de prueba a este computador',
              icono: 'ti-bell-ringing',
              tono: 'ok',
            });
            this.addActivityLog('success', 'Avisos del computador activados');
          } else {
            this.mostrarResultado({
              titulo: 'Los avisos están bloqueados',
              subtitulo: 'No te llegarán avisos en este computador',
              icono: 'ti-bell-off',
              tono: 'aviso',
              nota: 'Toca el candado junto a la dirección de la página, busca «Notificaciones» y elige «Permitir».',
            });
            this.addActivityLog('warning', 'Avisos del computador bloqueados');
          }
        },
        error: () => this.mostrarResultado({ titulo: 'No se pudo probar', subtitulo: 'Intenta de nuevo', icono: 'ti-alert-circle', tono: 'error' }),
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
          this.mostrarResultado({
            titulo: 'Conexión correcta',
            subtitulo: 'El servidor de AlertaMujer responde',
            icono: 'ti-wifi',
            tono: 'ok',
            filas: [{ etiqueta: 'Tiempo de respuesta', valor: `${segundos} s` }],
            nota: duration > 10000 ? 'El servidor estaba en reposo y tardó en despertar.' : undefined,
          });
          this.addActivityLog('success', `Conexión con el servidor correcta (${segundos} s)`);
        } else {
          this.mostrarResultado({
            titulo: 'El servidor tiene un problema',
            subtitulo: 'Respondió con un error',
            icono: 'ti-server-off',
            tono: 'error',
            filas: [{ etiqueta: 'Código', valor: String(response.status) }],
          });
          this.addActivityLog('warning', `El servidor respondió con error ${response.status}`);
        }
      })
      .catch(() => {
        this.mostrarResultado({
          titulo: navigator.onLine ? 'El servidor no responde' : 'Sin internet',
          subtitulo: navigator.onLine ? 'Tu internet funciona, pero el servidor no contestó' : 'Revisa tu conexión a internet',
          icono: 'ti-wifi-off',
          tono: 'error',
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
          this.mostrarResultado({
            titulo: 'Datos actualizados',
            subtitulo: 'Se trajo la información más reciente del servidor',
            icono: 'ti-refresh',
            tono: 'ok',
            filas: [
              { etiqueta: 'Celulares vinculados', valor: String(this.misCelulares().length) },
              { etiqueta: 'Contactos de emergencia', valor: String(f?.emergencyContactsCount ?? 0) },
              { etiqueta: 'Última ubicación', valor: f?.lastLocationCaptured ?? 'No registrada' },
            ],
          });
          this.addActivityLog('success', 'Datos sincronizados con el servidor');
        } else {
          this.mostrarResultado({
            titulo: 'No se pudo actualizar todo',
            subtitulo: 'El servidor no respondió a tiempo',
            icono: 'ti-refresh-alert',
            tono: 'aviso',
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
      this.mostrarResultado({
        titulo: 'Caché limpiada',
        subtitulo: `${clearedCount} ${clearedCount === 1 ? 'dato temporal eliminado' : 'datos temporales eliminados'}`,
        icono: 'ti-trash',
        tono: 'ok',
      });
      this.addActivityLog('success', `Caché limpiada: ${clearedCount} elementos`);
      this.loadCriticalFeatures();
    } catch {
      this.mostrarResultado({ titulo: 'No se pudo limpiar la caché', subtitulo: 'Intenta de nuevo', icono: 'ti-alert-circle', tono: 'error' });
    }
  }

  /** Vuelve a consultar los permisos que informó el celular y el estado de los servicios. */
  refreshPermissions(): void {
    this.loading.set(true);
    this.loadServices();
    this.actualizarSesion();
    this.featuresSub?.unsubscribe();
    this.featuresSub = this.fetchCriticalFeatures()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(() => {
        this.updateMobileServices();
        this.updateLastRefresh();
        const pc = this.permisosCelular();
        this.addActivityLog('info', pc
          ? `Permisos revisados: ${pc.lista.length - pc.faltan} de ${pc.lista.length} listos`
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
    if (this.relojSesion) clearInterval(this.relojSesion);
    this.destroy$.next();
    this.destroy$.complete();
  }
}
