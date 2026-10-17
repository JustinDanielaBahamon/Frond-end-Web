import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject, Subscription, catchError, finalize, forkJoin, map, of, takeUntil } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { DeviceInfoService } from '../../../core/services/device-info.service';
import { PermissionsService } from '../../../core/services/permissions.service';
import { DeviceService, UserDevice } from '../../../core/services/device.service';
import { EmergencyContactService } from '../../../core/services/emergency-contact.service';
import { PhoneLocationService } from '../../../core/services/phone.location.services';
import { AuthService } from '../../../core/auth/auth.service';
import { UbicacionEntry } from '../../../core/models/location.model';
import {
  DeviceInfo,
  PermissionStatus,
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
}

const ESTADOS_GPS: Record<string, string> = {
  active: 'Activo', inactive: 'Apagado', denied: 'Permiso denegado', unknown: 'Sin dato',
};
const ESTADOS_DISPOSITIVO: Record<string, string> = {
  active: 'Activo', inactive: 'Inactivo', blocked: 'Bloqueado', lost: 'Reportado como perdido',
};

@Component({
  selector: 'app-device',
  standalone: true,
  imports: [CommonModule],
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

  // Estado reactivo con signals
  deviceInfo = signal<DeviceInfo | null>(null);
  permissions = signal<PermissionStatus[]>([]);
  services = signal<ServiceStatus[]>([]);
  isOnline = signal<boolean>(true);
  connectionQuality = signal<string>('Desconocida');
  criticalFeatures = signal<CriticalFeatureStatus | null>(null);
  activityLog = signal<ActivityLog[]>([]);
  /** Celulares en los que la usuaria inició sesión con la app móvil. */
  misCelulares = signal<UserDevice[]>([]);
  /** Ventana con el detalle de un dispositivo (celular o este computador). */
  detalle = signal<DetalleDispositivo | null>(null);

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
    this.loadPermissions();
    this.loadServices();
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

  private loadPermissions(): void {
    this.permissionsService.checkAllPermissions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (perms) => this.permissions.set(perms),
        error: (error) => console.error('Error loading permissions:', error)
      });
  }

  private loadServices(): void {
    const services: ServiceStatus[] = [
      {
        name: 'Celular Vinculado',
        enabled: false,
        details: 'Se actualiza al sincronizar'
      },
      {
        name: 'Token Push Activo',
        enabled: false,
        details: 'Notificaciones push en el celular'
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
        return contacts !== null && devices !== null && latest !== FAILED;
      }),
      finalize(() => this.featuresLoading.set(false)),
      takeUntil(this.destroy$)
    );
  }

  private formatLocation(entry: UbicacionEntry): string {
    const when = entry.recordedAt
      ? new Date(entry.recordedAt).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : entry.time;
    return `${when} · ${entry.lat.toFixed(5)}, ${entry.lng.toFixed(5)}`;
  }

  private updateMobileServices(): void {
    const features = this.criticalFeatures();
    if (!features) return;

    this.updateServiceStatus('Celular Vinculado', (features.registeredDevices ?? 0) > 0);
    this.updateServiceStatus('Token Push Activo', features.pushTokenRegistered);
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

  // ─── MÉTODOS DE PRUEBAS DE FUNCIONALIDAD ─────────────────

  viewMobileLocation(): void {
    const features = this.criticalFeatures();
    const loc = features?.lastLocationCaptured;
    if (loc && loc !== 'No disponible') {
      alert('Última ubicación del celular: ' + loc);
    } else {
      alert('No hay ubicación registrada desde la app móvil. Abre la app en tu celular para registrar tu ubicación.');
    }
  }

  testGeolocation(): void {
    this.viewMobileLocation();
  }

  requestNotificationPermission(): void {
    if (!('Notification' in window)) {
      alert('⚠️ Las notificaciones no están disponibles en este navegador.');
      return;
    }

    this.permissionsService.requestNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (permission) => {
          if (permission === 'granted') {
            alert('✅ Permiso de notificación concedido correctamente.');
            this.addActivityLog('success', 'Permiso de notificación concedido');
            this.refreshPermissions();
          } else if (permission === 'denied') {
            alert('❌ Permiso de notificación denegado.');
            this.addActivityLog('warning', 'Permiso de notificación denegado por el usuario');
          } else {
            alert('⚠️ Solicitud de permiso cancelada.');
          }
        },
        error: (err) => {
          alert('❌ Error al solicitar permiso de notificación.');
          console.error('Error requesting notification permission:', err);
        }
      });
  }

  testNotificationDisplay(): void {
    alert('Las notificaciones push se gestionan desde la app móvil en tu celular.');
  }

  testConnectivity(): void {
    const startTime = Date.now();
    
    this.loading.set(true);
    
    // Try backend health endpoint first, fallback to external canary if backend fails.
    // /health es público. En el plan gratis de Render la primera petición despierta
    // el servidor y puede tardar varios minutos; se espera hasta 90 s y luego se avisa.
    const backendUrl = `${environment.apiUrl}/health`;
    const fallbackUrl = 'https://www.google.com/favicon.ico';

    fetch(backendUrl, { method: 'GET', signal: AbortSignal.timeout(90000) })
      .then(response => {
        const duration = Date.now() - startTime;
        if (response.ok) {
          const wokeUp = duration > 10000 ? '\n\nEl servidor estaba en reposo y tardó en despertar.' : '';
          alert(`✅ Conectividad OK\n\nServidor: Backend\nTiempo de respuesta: ${duration}ms\nEstado: ${response.status}${wokeUp}`);
          this.addActivityLog('success', `Prueba de conectividad exitosa con backend (${duration}ms)`);
        } else {
          alert(`⚠️ Backend responde con error\n\nEstado: ${response.status}\nTiempo: ${duration}ms`);
          this.addActivityLog('warning', `Backend respondió con error ${response.status} (${duration}ms)`);
        }
        this.loading.set(false);
      })
      .catch(() => {
        // Fallback to external endpoint if backend is unreachable
        const fallbackStartTime = Date.now();
        fetch(fallbackUrl, { method: 'HEAD', mode: 'no-cors' })
          .then(() => {
            const duration = Date.now() - fallbackStartTime;
            alert(`⚠️ Conectividad limitada\n\nBackend no accesible, pero conexión a internet activa.\nSi el servidor estaba en reposo puede tardar hasta 3 minutos en despertar: intenta de nuevo en un momento.\nTiempo: ${duration}ms`);
            this.addActivityLog('warning', `Backend no accesible, conexión externa OK (${duration}ms)`);
            this.loading.set(false);
          })
          .catch(error => {
            const duration = Date.now() - startTime;
            alert(`❌ Error de conectividad total\n\n${error.message}\nTiempo: ${duration}ms`);
            this.addActivityLog('error', `Error de conectividad total: ${error.message}`);
            this.loading.set(false);
          });
      });
  }

  // ─── MÉTODOS DE ACCIONES RÁPIDAS ─────────────────

  syncData(): void {
    this.loading.set(true);
    this.featuresSub?.unsubscribe();
    this.featuresSub = this.fetchCriticalFeatures()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(ok => {
        if (ok) {
          alert('✅ Datos sincronizados con el servidor');
          this.addActivityLog('success', 'Sincronización de datos completada');
        } else {
          alert('⚠️ No se pudieron traer todos los datos del servidor. Intenta de nuevo en un momento.');
          this.addActivityLog('warning', 'Sincronización incompleta: el servidor no respondió');
        }
      });
  }

  clearCache(): void {
    const confirmClear = confirm('¿Estás segura de que deseas limpiar la caché local? Esta acción eliminará datos temporales pero no afectará tu sesión ni contactos de emergencia.');
    
    if (confirmClear) {
      try {
        // Preserve critical keys including the actual session key used by AuthService
        // AuthService uses 'alerta_session' (not 'auth_token'), plus user-scoped data
        const keysToKeep = [
          'alerta_session',              // Actual session key from AuthService
          'user_data',
          'emergency_contacts',          // Legacy key (if still used)
          'emergency_contacts_user_',    // User-scoped version
          'notification_token_user_',    // User-scoped tokens
          'last_location_user_',         // User-scoped location
          'device_activity_log_user_'    // Activity logs
        ];
        const allKeys = Object.keys(localStorage);
        
        let clearedCount = 0;
        allKeys.forEach(key => {
          // Keep key if it matches any of the protected patterns
          const shouldKeep = keysToKeep.some(pattern => key.includes(pattern));
          if (!shouldKeep) {
            localStorage.removeItem(key);
            clearedCount++;
          }
        });

        alert(`✅ Caché limpiada: ${clearedCount} elementos eliminados`);
        this.addActivityLog('success', `Caché limpiada: ${clearedCount} elementos`);
        this.loadCriticalFeatures();
      } catch (error) {
        alert('❌ Error al limpiar caché');
        this.addActivityLog('error', 'Error al limpiar caché');
      }
    }
  }

  exportDiagnostic(): void {
    // Warn user about potentially sensitive data in diagnostic export
    const confirmExport = confirm(
      '⚠️ Aviso de Privacidad\n\n' +
      'El diagnóstico exportado contiene información que puede identificar tu dispositivo:\n' +
      '• Navegador, sistema operativo y versión\n' +
      '• Resolución de pantalla\n' +
      '• Historial de actividad reciente\n\n' +
      'Solo comparte este archivo con personal de soporte de confianza.\n\n' +
      '¿Deseas continuar con la exportación?'
    );

    if (!confirmExport) {
      return;
    }

    try {
      const diagnostic = {
        timestamp: new Date().toISOString(),
        deviceInfo: this.deviceInfo(),
        permissions: this.permissions(),
        services: this.services(),
        isOnline: this.isOnline(),
        connectionQuality: this.connectionQuality(),
        criticalFeatures: this.criticalFeatures(),
        activityLog: this.activityLog(),
        screenInfo: this.deviceInfoService.getScreenInfo()
      };

      const blob = new Blob([JSON.stringify(diagnostic, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      a.href = url;
      a.download = `diagnostico-alerta-mujer-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.addActivityLog('success', 'Diagnóstico exportado correctamente');
      alert('✅ Diagnóstico exportado correctamente');
    } catch (error) {
      alert('❌ Error al exportar diagnóstico');
      this.addActivityLog('error', 'Error al exportar diagnóstico');
    }
  }

  refreshPermissions(): void {
    this.loading.set(true);
    this.loadPermissions();
    this.loadServices();
    this.loadCriticalFeatures();
    this.updateLastRefresh();
    setTimeout(() => {
      this.loading.set(false);
      this.addActivityLog('info', 'Permisos y servicios actualizados');
    }, 500);
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
    this.destroy$.next();
    this.destroy$.complete();
  }
}
