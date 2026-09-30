import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { delay } from 'rxjs/operators';
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
  type: 'Android';
  imei: string;
  phone: string;
  status: 'Activo' | 'Inactivo' | 'Bloqueado';
  lastSync: string;
  icon: string;
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
    return this.http.get<Device[]>(this.url);
  }

  /**
   * Obtener dispositivo por ID
   */
  getById(id: number): Observable<Device> {
    return this.http.get<Device>(`${this.url}/${id}`);
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
    const sincronizadosHoy = devices.filter(d => d.lastSync.includes('Hoy')).length;
    
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
  cambiarEstado(id: number, nuevoEstado: 'Activo' | 'Inactivo' | 'Bloqueado'): Observable<Device> {
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

  /**
   * Filtrar dispositivos
   */
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
