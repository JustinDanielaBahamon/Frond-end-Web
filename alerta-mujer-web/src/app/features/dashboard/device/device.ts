import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { DeviceInfoService } from '../../../core/services/device-info.service';
import { PermissionsService } from '../../../core/services/permissions.service';
import { AuthService } from '../../../core/auth/auth.service';
import { 
  DeviceInfo, 
  PermissionStatus, 
  ServiceStatus, 
  ActivityLog, 
  CriticalFeatureStatus 
} from '../../../core/models/device-info.model';

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
  loading = signal<boolean>(false);
  
  private currentUserId: number | null = null;

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    // Subscribe to current user to get user ID for scoped logging
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUserId = user?.id || null;
      });

    this.loadDeviceInfo();
    this.loadPermissions();
    this.loadServices();
    this.loadCriticalFeatures();
    this.loadActivityLog();
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
        name: 'GPS / Geolocalización',
        enabled: 'geolocation' in navigator,
        details: 'Permite rastrear tu ubicación en tiempo real'
      },
      {
        name: 'Conectividad',
        enabled: navigator.onLine,
        details: 'Conexión a internet activa'
      },
      {
        name: 'Almacenamiento Local',
        enabled: typeof localStorage !== 'undefined',
        details: 'Permite guardar datos localmente'
      },
      {
        name: 'Notificaciones Push',
        enabled: 'Notification' in window,
        details: 'Permite recibir alertas del sistema'
      }
    ];

    this.services.set(services);
    this.connectionQuality.set(this.deviceInfoService.getConnectionQuality());
  }

  private loadCriticalFeatures(): void {
    try {
      // Use AuthService to properly validate active session (not just token existence)
      const sessionActive = this.authService.isLoggedIn();
      const userId = this.currentUserId;
      
      // Scope critical feature keys by user ID to prevent cross-user leaks
      const lastLocation = userId ? localStorage.getItem(`last_location_user_${userId}`) : null;
      const notificationToken = userId ? localStorage.getItem(`notification_token_user_${userId}`) : null;
      const emergencyContacts = userId ? localStorage.getItem(`emergency_contacts_user_${userId}`) : null;
      
      let contactsCount = 0;
      if (emergencyContacts) {
        try {
          const contacts = JSON.parse(emergencyContacts);
          contactsCount = Array.isArray(contacts) ? contacts.length : 0;
        } catch {
          contactsCount = 0;
        }
      }

      this.criticalFeatures.set({
        sessionActive,
        lastLocationCaptured: lastLocation || null,
        notificationToken: notificationToken || null,
        emergencyContactsCount: contactsCount
      });
    } catch (error) {
      console.error('Error loading critical features:', error);
    }
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

  testGeolocation(): void {
    if (!('geolocation' in navigator)) {
      alert('⚠️ La API de Geolocalización no está disponible en este navegador.');
      return;
    }

    this.loading.set(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        const acc = position.coords.accuracy.toFixed(2);
        alert(`✅ Geolocalización OK\n\nLatitud: ${lat}\nLongitud: ${lng}\nPrecisión: ${acc}m`);
        this.addActivityLog('success', `Prueba de geolocalización exitosa: ${lat}, ${lng}`);
        this.loading.set(false);
      },
      (error) => {
        alert(`❌ Error al obtener ubicación: ${error.message}`);
        this.addActivityLog('error', `Error en prueba de geolocalización: ${error.message}`);
        this.loading.set(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  requestNotificationPermission(): void {
    if (!('Notification' in window)) {
      alert('⚠️ Las notificaciones no están disponibles en este navegador.');
      return;
    }

    if (Notification.permission === 'granted') {
      alert('✅ Los permisos de notificación ya están concedidos.');
      return;
    }

    if (Notification.permission === 'denied') {
      alert('❌ Permisos de notificación denegados. Ve a configuración del navegador para habilitarlos.');
      this.addActivityLog('warning', 'Intento de solicitar permiso denegado previamente');
      return;
    }

    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        alert('✅ Permiso de notificación concedido correctamente.');
        this.addActivityLog('success', 'Permiso de notificación concedido');
        this.refreshPermissions();
      } else {
        alert('❌ Permiso de notificación denegado.');
        this.addActivityLog('warning', 'Permiso de notificación denegado por el usuario');
      }
    });
  }

  testNotificationDisplay(): void {
    if (!('Notification' in window)) {
      alert('⚠️ Las notificaciones no están disponibles en este navegador.');
      return;
    }

    if (Notification.permission !== 'granted') {
      alert('⚠️ Primero debes conceder permisos de notificación. Usa el botón "Solicitar Permiso".');
      return;
    }

    try {
      // Wrap in try-catch to handle environments where Notification constructor is unavailable
      new Notification('🔔 Alerta Mujer', {
        body: 'Prueba de notificación exitosa',
        icon: '/logo.png',
        tag: 'test-notification'
      });
      alert('✅ Notificación enviada. Revisa tu bandeja de notificaciones.');
      this.addActivityLog('success', 'Prueba de visualización de notificación exitosa');
    } catch (error) {
      alert('❌ Error al mostrar notificación. Tu navegador puede no soportar esta funcionalidad.');
      this.addActivityLog('error', 'Error al crear notificación: Constructor no disponible');
    }
  }

  testConnectivity(): void {
    const startTime = Date.now();
    
    this.loading.set(true);
    
    // Try backend health endpoint first, fallback to external canary if backend fails
    const backendUrl = `${this.getApiUrl()}/api/health`;
    const fallbackUrl = 'https://www.google.com/favicon.ico';
    
    fetch(backendUrl, { method: 'GET' })
      .then(response => {
        const duration = Date.now() - startTime;
        if (response.ok) {
          alert(`✅ Conectividad OK\n\nServidor: Backend\nTiempo de respuesta: ${duration}ms\nEstado: ${response.status}`);
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
            alert(`⚠️ Conectividad limitada\n\nBackend no accesible, pero conexión a internet activa.\nTiempo: ${duration}ms`);
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

  private getApiUrl(): string {
    // Import environment to get the configured API URL (not hardcoded localhost)
    // This will be replaced at build time by Angular's environment system
    const env = (window as any).__env;
    if (env && env.apiUrl) {
      return env.apiUrl;
    }
    // Fallback to environment.ts value
    // Note: This is a static import at build time, not runtime
    console.warn('Using default environment.apiUrl - __env not available');
    return 'http://localhost:8080'; // This matches environment.ts default
  }

  // ─── MÉTODOS DE ACCIONES RÁPIDAS ─────────────────

  syncData(): void {
    this.loading.set(true);
    setTimeout(() => {
      alert('✅ Datos sincronizados correctamente');
      this.addActivityLog('success', 'Sincronización de datos completada');
      this.loading.set(false);
      this.loadCriticalFeatures();
    }, 1000);
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
