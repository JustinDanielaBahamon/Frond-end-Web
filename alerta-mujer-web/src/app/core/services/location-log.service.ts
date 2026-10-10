import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, map as rxmap } from 'rxjs';
import { map as rxmap2 } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { LocationLog, LocationLogApi } from '../models/location-log.model';
import { UbicacionEntry } from '../models/location.model';

// Subject para rastrear ubicación en tiempo real
// private currentLocationSubject = new BehaviorSubject<LocationLog | null>(null);
// currentLocation$ = this.currentLocationSubject.asObservable();

// Ubicaciones recientes del usuario
// private userLocationsSubject = new BehaviorSubject<UbicacionEntry[]>([]);
// userLocations$ = this.userLocationsSubject.asObservable();

// Mapping: LocationLogApi -> UbicacionEntry
private mapLocationLogToEntry(log: LocationLogApi): UbicacionEntry {
  const date = log.date ? new Date(log.date) : new Date(log.recordedAt);
  return {
    id: log.id,
    usuarioId: log.userProfileId,
    time: date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    address: 'Ubicación registrada',
    gpsSignal: 'Fuerte',
    battery: 100,
    lat: log.latitude,
    lng: log.longitude,
    date: date.toISOString().split('T')[0],
    connectionType: undefined,
    deviceName: undefined,
  };
}

// Mapping: UbicacionEntry -> LocationLog (for sending)
private mapEntryToLocationLog(entry: UbicacionEntry): LocationLog {
  const date = entry.date ? new Date(entry.date) : new Date();
  return {
    id: entry.id,
    userProfileId: entry.usuarioId,
    alertId: undefined,
    latitude: entry.lat,
    longitude: entry.lng,
    accuracy: undefined,
    recordedAt: date.toISOString(),
  };
}

@Injectable({ providedIn: 'root' })
export class LocationLogService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/location-logs`;

  // Subject para rastrear ubicación en tiempo real
  private currentLocationSubject = new BehaviorSubject<LocationLog | null>(null);
  currentLocation$ = this.currentLocationSubject.asObservable();

  // Ubicaciones recientes del usuario
  private userLocationsSubject = new BehaviorSubject<UbicacionEntry[]>([]);
  userLocations$ = this.userLocationsSubject.asObservable();

  constructor() {}

  /**
   * Enviar una nueva ubicación (POST)
   * Endpoint: POST /api/location-logs
   */
  sendLocation(location: Omit<LocationLog, 'id' | 'recordedAt' | 'userProfileId'>): Observable<LocationLog> {
    const body = {
      ...location,
      recordedAt: new Date().toISOString(),
      userProfileId: undefined
    };
    return this.http.post<LocationLog>(this.apiUrl, body);
  }

  /**
   * Obtener ubicación actual en tiempo real
   */
  setCurrentLocation(location: LocationLog): void {
    this.currentLocationSubject.next(location);
  }

  /**
   * Obtener la ubicación actual en tiempo real como observable
   */
  getCurrentLocation(): Observable<LocationLog | null> {
    return this.currentLocation$.asObservable();
  }

  /**
   * Obtener historial de ubicaciones del usuario
   * Endpoint: GET /api/location-logs/user/{userProfileId}
   */
  getUserLocations(userProfileId: number): Observable<UbicacionEntry[]> {
    return this.http.get<LocationLogApi[]>(`${this.apiUrl}/user/${userProfileId}`).pipe(
      rxmap2<LocationLogApi[], UbicacionEntry[]>((logs: LocationLogApi[]) => logs.map(log => this.mapLocationLogToEntry(log)))
    );
  }

  /**
   * Obtener últimas N ubicaciones del usuario
   * Endpoint: GET /api/location-logs/user/{userProfileId}/recent?limit=N
   */
  getRecentUserLocations(userProfileId: number, limit: number = 50): Observable<UbicacionEntry[]> {
    return this.http.get<LocationLogApi[]>(`${this.apiUrl}/user/${userProfileId}/recent?limit=${limit}`).pipe(
      rxmap2<LocationLogApi[], UbicacionEntry[]>((logs: LocationLogApi[]) => logs.map(log => this.mapLocationLogToEntry(log)))
    );
  }

  /**
   * Test de conexión con el backend
   */
  testConnection(): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/test-connection`);
  }
}