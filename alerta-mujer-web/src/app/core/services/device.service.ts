import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { delay } from 'rxjs/operators';

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
  private url = '/api/dispositivos'; // URL base para la API (se cambiará cuando se conecte al backend)

  // Datos mock iniciales (se eliminarán cuando se conecte al backend)
  private devicesMock: Device[] = [
    {
      id: 1,
      name: 'Samsung Galaxy A54',
      osVersion: 'Android 13',
      user: { name: 'María Fernanda López', email: 'maria.lopez@gmail.com' },
      type: 'Android',
      imei: '354684123456789',
      phone: '311 245 6789',
      status: 'Activo',
      lastSync: 'Hoy, 10:24 a.m.',
      icon: 'fa-brands fa-android'
    },
    {
      id: 2,
      name: 'Xiaomi Redmi Note 12',
      osVersion: 'Android 12',
      user: { name: 'Valentina Castro', email: 'valentina.castro@gmail.com' },
      type: 'Android',
      imei: '862341567890123',
      phone: '315 987 6543',
      status: 'Inactivo',
      lastSync: 'Ayer, 08:45 p.m.',
      icon: 'fa-brands fa-android'
    },
    {
      id: 6,
      name: 'Samsung Galaxy S22',
      osVersion: 'Android 13',
      user: { name: 'Sofía Herrera', email: 'sofia.herrera@gmail.com' },
      type: 'Android',
      imei: '352147896325987',
      phone: '311 753 9514',
      status: 'Activo',
      lastSync: 'Hoy, 11:05 a.m.',
      icon: 'fa-brands fa-android'
    }
  ];

  private devicesSubject = new BehaviorSubject<Device[]>(this.devicesMock);
  devices$ = this.devicesSubject.asObservable();

  private statsMock: DeviceStats = {
    totalDevices: 6,
    activeDevices: 4,
    inactiveDevices: 1,
    blockedDevices: 1,
    syncedToday: 4
  };

  private statsSubject = new BehaviorSubject<DeviceStats>(this.statsMock);
  stats$ = this.statsSubject.asObservable();

  // ========================================
  // MÉTODOS API (Futuros - preparados)
  // ========================================

  /**
   * Obtener todos los dispositivos (API futura)
   */
  getAll(): Observable<Device[]> {
    // En el futuro: return this.http.get<Device[]>(this.url);
    return this.devices$;
  }

  /**
   * Obtener dispositivo por ID (API futura)
   */
  getById(id: number): Observable<Device> {
    // En el futuro: return this.http.get<Device>(`${this.url}/${id}`);
    const device = this.devicesMock.find(d => d.id === id);
    return of(device as Device).pipe(delay(300));
  }

  /**
   * Crear nuevo dispositivo (API futura)
   */
  create(device: Omit<Device, 'id'>): Observable<Device> {
    // En el futuro: return this.http.post<Device>(this.url, device);
    console.log('DeviceService.create llamado con:', device);
    
    const nuevoDevice: Device = {
      ...device,
      id: Date.now()
    };
    
    this.devicesMock = [...this.devicesMock, nuevoDevice];
    this.devicesSubject.next(this.devicesMock);
    this.actualizarEstadisticas(); // Actualizar estadísticas
    console.log('Dispositivo creado exitosamente en servicio:', nuevoDevice);
    return of(nuevoDevice).pipe(delay(500));
  }

  /**
   * Actualizar dispositivo (API futura)
   */
  update(id: number, device: Device): Observable<Device> {
    // En el futuro: return this.http.put<Device>(`${this.url}/${id}`, device);
    console.log('DeviceService.update llamado con id:', id, 'device:', device);
    const index = this.devicesMock.findIndex(d => d.id === id);
    console.log('Índice encontrado:', index);
    if (index !== -1) {
      this.devicesMock[index] = device;
      this.devicesSubject.next(this.devicesMock);
      this.actualizarEstadisticas(); // Actualizar estadísticas
      console.log('Dispositivo actualizado en índice:', index);
    } else {
      console.error('No se encontró dispositivo con id:', id);
    }
    return of(device).pipe(delay(500));
  }

  /**
   * Eliminar dispositivo (API futura)
   */
  delete(id: number): Observable<void> {
    // En el futuro: return this.http.delete<void>(`${this.url}/${id}`);
    this.devicesMock = this.devicesMock.filter(d => d.id !== id);
    this.devicesSubject.next(this.devicesMock);
    this.actualizarEstadisticas(); // Actualizar estadísticas
    return of(void 0).pipe(delay(300));
  }

  /**
   * Obtener estadísticas (API futura)
   */
  getStats(): Observable<DeviceStats> {
    // En el futuro: return this.http.get<DeviceStats>(`${this.url}/stats`);
    // Calcular estadísticas dinámicamente basándose en los dispositivos actuales
    const stats = this.calcularEstadisticas();
    return of(stats).pipe(delay(200));
  }

  /**
   * Calcular estadísticas dinámicamente desde los dispositivos
   */
  private calcularEstadisticas(): DeviceStats {
    const total = this.devicesMock.length;
    const activos = this.devicesMock.filter(d => d.status === 'Activo').length;
    const inactivos = this.devicesMock.filter(d => d.status === 'Inactivo').length;
    const bloqueados = this.devicesMock.filter(d => d.status === 'Bloqueado').length;
    const sincronizadosHoy = this.devicesMock.filter(d => d.lastSync.includes('Hoy')).length;
    
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
    this.statsMock = stats;
    this.statsSubject.next(stats);
  }

  /**
   * Cambiar estado de dispositivo (API futura)
   */
  cambiarEstado(id: number, nuevoEstado: 'Activo' | 'Inactivo' | 'Bloqueado'): Observable<Device> {
    const device = this.devicesMock.find(d => d.id === id);
    if (device) {
      device.status = nuevoEstado;
      this.devicesSubject.next(this.devicesMock);
      this.actualizarEstadisticas(); // Actualizar estadísticas
      return of(device).pipe(delay(300));
    }
    return of({} as Device).pipe(delay(300));
  }

  /**
   * Filtrar dispositivos (API futura)
   */
  filtrarDispositivos(filtros: DeviceFilters): Observable<Device[]> {
    let dispositivosFiltrados = [...this.devicesMock];

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
