import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LocationEntry, LocationLogApi } from '../../core/models/location.model';

@Injectable({ providedIn: 'root' })
export class PhoneLocationService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/location-logs`;

  // Transforma LocationLogApi del backend a UbicacionEntry del frontend.
  // El backend guarda recordedAt en UTC sin zona ("2026-10-13T04:40:07"), así que se marca como UTC.
  private mapLocationLogToEntry(log: LocationLogApi): LocationEntry {
    const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(log.recordedAt) ? log.recordedAt : `${log.recordedAt}Z`;
    const date = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      id: log.id,
      userId: log.userProfileId,
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
  getMine(limit = 50): Observable<LocationEntry[]> {
    return this.http.get<LocationLogApi[]>(`${this.url}/me`, { params: { limit } }).pipe(
      map(logs => logs.map(log => this.mapLocationLogToEntry(log)))
    );
  }

  /** Pide al celular (push silencioso) que envíe su ubicación actual. */
  requestFromPhone(): Observable<{ celulares: number; solicitadoEn: string }> {
    return this.http.post<{ celulares: number; solicitadoEn: string }>(`${this.url}/me/request`, {});
  }

  /** Última ubicación que envió el celular (null si nunca ha enviado). */
  getLatest(): Observable<LocationEntry | null> {
    return this.http.get<LocationLogApi | null>(`${this.url}/me/latest`).pipe(
      map(log => (log ? this.mapLocationLogToEntry(log) : null))
    );
  }

  // Usado por USUARIA: solo su propio historial de ubicaciones
  getByUser(userId: number): Observable<LocationEntry[]> {
    return this.http.get<LocationLogApi[]>(`${this.url}/user/${userId}`).pipe(
      map(logs => logs.map(log => this.mapLocationLogToEntry(log)))
    );
  }
}