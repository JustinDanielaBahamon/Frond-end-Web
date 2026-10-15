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
}

const ESTADO_DESDE_API: Record<string, Device['status']> = {
  active: 'Activo', inactive: 'Inactivo', blocked: 'Bloqueado', lost: 'Perdido',
};
const ESTADO_HACIA_API: Record<Device['status'], string> = {
  Activo: 'active', Inactivo: 'inactive', Bloqueado: 'blocked', Perdido: 'lost',
};

const esHoy = (iso?: string | null) => !!iso && new Date(iso).toDateString() === new Date().toDateString();

function formatearUltimoAcceso(iso: string | null): string {
  if (!iso) return 'Sin registro';
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return 'Sin registro';
  const hora = fecha.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  return esHoy(iso) ? `Hoy, ${hora}` : `${fecha.toLocaleDateString('es-CO')} ${hora}`;
}

function desdeApi(d: AdminDeviceApi): Device {
  const nombre = [d.brand, d.model].filter(Boolean).join(' ');
  return {
    id: d.id,
    name: nombre || 'Dispositivo sin nombre',
    osVersion: d.osVersion ? `${d.osName ?? ''} ${d.osVersion}`.trim() : (d.osName ?? ''),
    user: { name: d.ownerName ?? 'Sin usuaria', email: d.ownerEmail ?? '' },
    type: 'Android',
    imei: d.deviceUuid ?? '',
    phone: d.ownerPhone ?? '',
    status: ESTADO_DESDE_API[d.status] ?? 'Inactivo',
    lastSync: formatearUltimoAcceso(d.lastAccess),
    icon: 'fa-brands fa-android',
    appVersion: d.appVersion,
    gpsStatus: d.gpsStatus,
    pushTokenRegistered: d.pushTokenRegistered,
    lastAccessIso: d.lastAccess,
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
  brand: string | null;
  model: string | null;
  osName: string;
  osVersion: string | null;
  appVersion: string | null;
  gpsStatus: string;
  status: string;
  lastAccess: string | null;
  fcmToken: string | null;
}

/**
 * Interfaz para filtros de dispositivos
 */
export interface DeviceFilters {
  busqueda: string;
  estado: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
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
      map(lista => lista.map(desdeApi)),
      // La lista local alimenta los filtros y las estadísticas
      tap(devices => {
        this.devicesSubject.next(devices);
        this.actualizarEstadisticas();
      }),
    );
  }

  /**
   * Celulares de la usuaria autenticada
   */
  getMyDevices(): Observable<UserDevice[]> {
    return this.http.get<UserDevice[]>(`${this.url}/user`);
  }

  /**
   * Obtener dispositivo por ID
   */
  getById(id: number): Observable<Device> {
    return this.http.get<AdminDeviceApi>(`${this.url}/${id}`).pipe(map(desdeApi));
  }

  /**
   * Crear nuevo dispositivo
   */
  create(device: Omit<Device, 'id'>): Observable<Device> {
    return this.http.post<Device>(this.url, device);
  }

  /**
   * Actualizar dispositivo
   */
  update(id: number, device: Device): Observable<Device> {
    return this.http.put<Device>(`${this.url}/${id}`, device);
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
    const stats = this.calcularEstadisticas();
    return of(stats).pipe(delay(200));
  }

  /**
   * Calcular estadísticas dinámicamente desde los dispositivos
   */
  private calcularEstadisticas(): DeviceStats {
    const devices = this.devicesSubject.value;
    const total = devices.length;
    const activos = devices.filter(d => d.status === 'Activo').length;
    const inactivos = devices.filter(d => d.status === 'Inactivo').length;
    const bloqueados = devices.filter(d => d.status === 'Bloqueado').length;
    const sincronizadosHoy = devices.filter(d => esHoy(d.lastAccessIso)).length;
    
    return {
      totalDevices: total,
      activeDevices: activos,
      inactiveDevices: inactivos,
      blockedDevices: bloqueados,
      syncedToday: sincronizadosHoy
    };
  }

  /**
   * Actualizar estadísticas y notificar a los suscriptores
   */
  private actualizarEstadisticas(): void {
    const stats = this.calcularEstadisticas();
    this.statsSubject.next(stats);
  }

  /**
   * Cambiar estado de dispositivo
   */
  cambiarEstado(id: number, nuevoEstado: Device['status']): Observable<Device> {
    const currentDevices = this.devicesSubject.value;
    const device = currentDevices.find(d => d.id === id);
    if (device) {
      device.status = nuevoEstado;
      this.devicesSubject.next(currentDevices);
      this.actualizarEstadisticas();
      return of(device).pipe(delay(300));
    }
    return of({} as Device).pipe(delay(300));
  }

  filtrarDispositivos(filtros: DeviceFilters): Observable<Device[]> {
    let dispositivosFiltrados = [...this.devicesSubject.value];

    // Filtro por búsqueda
    if (filtros.busqueda) {
      const busquedaLower = filtros.busqueda.toLowerCase();
      dispositivosFiltrados = dispositivosFiltrados.filter(device => {
        return (
          device.name.toLowerCase().includes(busquedaLower) ||
          device.imei.includes(busquedaLower) ||
          device.phone.includes(busquedaLower) ||
          device.user.name.toLowerCase().includes(busquedaLower) ||
          device.user.email.toLowerCase().includes(busquedaLower)
        );
      });
    }

    // Filtro por estado
    if (filtros.estado && filtros.estado !== 'all') {
      dispositivosFiltrados = dispositivosFiltrados.filter(device =>
        device.status === filtros.estado
      );
    }

    return of(dispositivosFiltrados).pipe(delay(200));
  }
}
