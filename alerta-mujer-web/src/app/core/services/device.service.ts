import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { delay, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Interfaz para definir la estructura de un dispositivo
 */
export interface Device {
  id: number;
  name: string;
  osVersion: string;
  user: {
    name: string;
    email: string;
  };
  type: 'Android';  // la app solo existe para Android
  imei: string;
  phone: string;
  status: 'Activo' | 'Inactivo' | 'Bloqueado' | 'Perdido';
  lastSync: string;
  icon: string;
  // Datos extra del backend (solo lectura)
  appVersion?: string | null;
  gpsStatus?: string | null;
  pushTokenRegistered?: boolean;
  lastAccessIso?: string | null;
  /** Nombre que le puso la usuaria al celular (p. ej. "Celular de Ana"). */
  deviceName?: string | null;
  registered?: string;
  /** Lo que la app informa que está listo para una emergencia (null si nunca lo informó). */
  permissions?: DevicePermission[] | null;
  permissionsUpdated?: string | null;
}

export interface DevicePermission {
  label: string;
  ready: boolean;
}

/** Permisos que informa la app, en el orden en que importan para una emergencia. */
const APP_PERMISSIONS: [string, string][] = [
  ['ubicacion', 'Ubicación'],
  ['notificaciones', 'Notificaciones'],
  ['agitar', 'Alerta al agitar'],
  ['bateria', 'Batería sin restricciones'],
  ['pantallaCompleta', 'Alarma a pantalla completa'],
  ['microfono', 'Micrófono'],
  ['camara', 'Cámara'],
];

function readPermissions(json: string | null): DevicePermission[] | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json) as Record<string, unknown>;
    return APP_PERMISSIONS.filter(([key]) => key in p).map(([key, label]) => ({ label, ready: p[key] === true }));
  } catch {
    return null;
  }
}

/** Dispositivo tal como lo devuelve el backend al panel de administración. */
interface AdminDeviceApi {
  id: number;
  accountId: number;
  userId: number | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  deviceUuid: string | null;
  brand: string | null;
  model: string | null;
  osName: string | null;
  osVersion: string | null;
  appVersion: string | null;
  gpsStatus: string | null;
  status: string;
  lastAccess: string | null;
  createdAt: string | null;
  pushTokenRegistered: boolean;
  deviceName: string | null;
  permissions: string | null;
  permissionsUpdatedAt: string | null;
}

const STATUS_FROM_API: Record<string, Device['status']> = {
  active: 'Activo', inactive: 'Inactivo', blocked: 'Bloqueado', lost: 'Perdido',
};
const STATUS_TO_API: Record<Device['status'], string> = {
  Activo: 'active', Inactivo: 'inactive', Bloqueado: 'blocked', Perdido: 'lost',
};

const isToday = (iso?: string | null) => !!iso && new Date(iso).toDateString() === new Date().toDateString();

function formatLastAccess(iso: string | null): string {
  if (!iso) return 'Sin registro';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return 'Sin registro';
  const time = date.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  return isToday(iso) ? `Hoy, ${time}` : `${date.toLocaleDateString('es-CO')} ${time}`;
}

function fromApi(d: AdminDeviceApi): Device {
  const name = [d.brand, d.model].filter(Boolean).join(' ');
  return {
    id: d.id,
    name: name || 'Dispositivo sin nombre',
    osVersion: d.osVersion ? `${d.osName ?? ''} ${d.osVersion}`.trim() : (d.osName ?? ''),
    user: { name: d.ownerName ?? 'Sin usuaria', email: d.ownerEmail ?? '' },
    type: 'Android',
    imei: d.deviceUuid ?? '',
    phone: d.ownerPhone ?? '',
    status: STATUS_FROM_API[d.status] ?? 'Inactivo',
    lastSync: formatLastAccess(d.lastAccess),
    icon: 'fa-brands fa-android',
    appVersion: d.appVersion,
    gpsStatus: d.gpsStatus,
    pushTokenRegistered: d.pushTokenRegistered,
    lastAccessIso: d.lastAccess,
    deviceName: d.deviceName,
    registered: formatLastAccess(d.createdAt),
    permissions: readPermissions(d.permissions),
    permissionsUpdated: d.permissionsUpdatedAt ? formatLastAccess(d.permissionsUpdatedAt) : null,
  };
}

/**
 * Interfaz para estadísticas de dispositivos
 */
export interface DeviceStats {
  totalDevices: number;
  activeDevices: number;
  inactiveDevices: number;
  blockedDevices: number;
  syncedToday: number;
}

/**
 * Celular que la app móvil registró para la usuaria (GET /api/devices/user)
 */
export interface UserDevice {
  id: number;
  deviceUuid?: string;
  deviceName?: string | null;
  createdAt?: string | null;
  brand: string | null;
  model: string | null;
  osName: string;
  osVersion: string | null;
  appVersion: string | null;
  gpsStatus: string;
  status: string;
  lastAccess: string | null;
  fcmToken: string | null;
  /** JSON con los permisos que informa la app, p. ej. {"ubicacion":true,"agitar":false}. */
  permissions?: string | null;
  permissionsUpdatedAt?: string | null;
}

/**
 * Interfaz para filtros de dispositivos
 */
export interface DeviceFilters {
  search: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
}

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/devices`;

  // Sin datos mock - se cargarán desde el backend
  private devicesSubject = new BehaviorSubject<Device[]>([]);
  devices$ = this.devicesSubject.asObservable();

  private statsSubject = new BehaviorSubject<DeviceStats>({
    totalDevices: 0,
    activeDevices: 0,
    inactiveDevices: 0,
    blockedDevices: 0,
    syncedToday: 0
  });
  stats$ = this.statsSubject.asObservable();

  // ========================================
  // MÉTODOS API (Conectar al backend)
  // ========================================

  /**
   * Obtener todos los dispositivos
   */
  getAll(): Observable<Device[]> {
    return this.http.get<AdminDeviceApi[]>(this.url).pipe(
      map(list => list.map(fromApi)),
      // La lista local alimenta los filtros y las estadísticas
      tap(devices => {
        this.devicesSubject.next(devices);
        this.updateStats();
      }),
    );
  }

  /**
   * Celulares de la usuaria autenticada
   */
  getMyDevices(): Observable<UserDevice[]> {
    // El panel web se registra como dispositivo "web" (notificaciones del navegador): no es un celular
    return this.http.get<UserDevice[]>(`${this.url}/user`).pipe(
      map(list => list.filter(d => (d.osName || '').toLowerCase() !== 'web')),
    );
  }

  /**
   * Obtener dispositivo por ID
   */
  getById(id: number): Observable<Device> {
    return this.http.get<AdminDeviceApi>(`${this.url}/${id}`).pipe(map(fromApi));
  }

  /**
   * Crear nuevo dispositivo
   */

  /**
   * Actualizar dispositivo
   */
  // Desde el panel solo se edita el estado; el resto lo registra la app móvil.
  update(id: number, device: Device): Observable<Device> {
    return this.changeStatus(id, device.status);
  }

  /**
   * Eliminar dispositivo
   */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /**
   * Obtener estadísticas
   */
  getStats(): Observable<DeviceStats> {
    // TODO: Conectar al backend
    // return this.http.get<DeviceStats>(`${this.url}/stats`);
    const stats = this.computeStats();
    return of(stats).pipe(delay(200));
  }

  /**
   * Calcular estadísticas dinámicamente desde los dispositivos
   */
  private computeStats(): DeviceStats {
    const devices = this.devicesSubject.value;
    const total = devices.length;
    const active = devices.filter(d => d.status === 'Activo').length;
    const inactive = devices.filter(d => d.status === 'Inactivo').length;
    const blocked = devices.filter(d => d.status === 'Bloqueado').length;
    const syncedToday = devices.filter(d => isToday(d.lastAccessIso)).length;
    
    return {
      totalDevices: total,
      activeDevices: active,
      inactiveDevices: inactive,
      blockedDevices: blocked,
      syncedToday
    };
  }

  /**
   * Actualizar estadísticas y notificar a los suscriptores
   */
  private updateStats(): void {
    const stats = this.computeStats();
    this.statsSubject.next(stats);
  }

  /**
   * Cambiar estado de dispositivo
   */
  changeStatus(id: number, newStatus: Device['status']): Observable<Device> {
    return this.http.patch<AdminDeviceApi>(`${this.url}/${id}/status`, { status: STATUS_TO_API[newStatus] }).pipe(
      map(fromApi),
      tap(updated => {
        this.devicesSubject.next(this.devicesSubject.value.map(d => (d.id === id ? updated : d)));
        this.updateStats();
      }),
    );
  }

  filterDevices(filters: DeviceFilters): Observable<Device[]> {
    let filteredDevices = [...this.devicesSubject.value];

    // Filtro por búsqueda
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredDevices = filteredDevices.filter(device => {
        return (
          device.name.toLowerCase().includes(searchLower) ||
          device.imei.includes(searchLower) ||
          device.phone.includes(searchLower) ||
          device.user.name.toLowerCase().includes(searchLower) ||
          device.user.email.toLowerCase().includes(searchLower)
        );
      });
    }

    // Filtro por estado
    if (filters.status && filters.status !== 'all') {
      filteredDevices = filteredDevices.filter(device =>
        device.status === filters.status
      );
    }

    return of(filteredDevices).pipe(delay(200));
  }
}
