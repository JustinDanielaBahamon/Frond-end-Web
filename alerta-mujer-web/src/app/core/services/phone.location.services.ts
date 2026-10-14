import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UbicacionEntry, LocationLogApi } from '../../core/models/location.model';

@Injectable({ providedIn: 'root' })
export class PhoneLocationService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/location-logs`;

  // Transforma LocationLogApi del backend a UbicacionEntry del frontend.
  // El backend guarda recordedAt en UTC sin zona ("2026-10-13T04:40:07"), así que se marca como UTC.
  private mapLocationLogToEntry(log: LocationLogApi): UbicacionEntry {
    const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(log.recordedAt) ? log.recordedAt : `${log.recordedAt}Z`;
    const date = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      id: log.id,
      usuarioId: log.userProfileId,
      time: date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      address: '',
      gpsSignal: 'Fuerte', // El backend no tiene señal GPS, valor por defecto
      battery: 100, // El backend no tiene batería, valor por defecto
      lat: Number(log.latitude),
      lng: Number(log.longitude),
      // Fecha local (toISOString daría la fecha UTC y cambiaría de día por la noche)
      date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      recordedAt: date.toISOString(),
      accuracy: log.accuracy != null ? Number(log.accuracy) : undefined,
    };
  }

  /** Historial de la usuaria autenticada (más reciente primero). */
  getMine(limit = 50): Observable<UbicacionEntry[]> {
    return this.http.get<LocationLogApi[]>(`${this.url}/me`, { params: { limit } }).pipe(
      map(logs => logs.map(log => this.mapLocationLogToEntry(log)))
    );
  }

  /** Última ubicación que envió el celular (null si nunca ha enviado). */
  getLatest(): Observable<UbicacionEntry | null> {
    return this.http.get<LocationLogApi | null>(`${this.url}/me/latest`).pipe(
      map(log => (log ? this.mapLocationLogToEntry(log) : null))
    );
  }

  // Usado por ADMIN: todas las ubicaciones
  getAll(): Observable<UbicacionEntry[]> {
    return this.http.get<LocationLogApi[]>(this.url).pipe(
      map(logs => logs.map(log => this.mapLocationLogToEntry(log)))
    );
  }

  // Usado por USUARIA: solo su propio historial de ubicaciones
  getByUsuario(usuarioId: number): Observable<UbicacionEntry[]> {
    return this.http.get<LocationLogApi[]>(`${this.url}/user/${usuarioId}`).pipe(
      map(logs => logs.map(log => this.mapLocationLogToEntry(log)))
    );
  }
}