import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LocationEntry, LocationLogApi } from '../../core/models/location.model';

@Injectable({ providedIn: 'root' })
export class PhoneLocationService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/location-logs`;

  // Transforms the backend LocationLogApi into the frontend LocationEntry.
  // The backend stores recordedAt in UTC without a zone ("2026-10-13T04:40:07"), so it is marked as UTC.
  private mapLocationLogToEntry(log: LocationLogApi): LocationEntry {
    const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(log.recordedAt) ? log.recordedAt : `${log.recordedAt}Z`;
    const date = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      id: log.id,
      userId: log.userProfileId,
      time: date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      address: '',
      gpsSignal: 'Fuerte', // The backend has no GPS signal, default value
      battery: 100, // The backend has no battery, default value
      lat: Number(log.latitude),
      lng: Number(log.longitude),
      // Local date (toISOString would give the UTC date and change the day at night)
      date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      recordedAt: date.toISOString(),
      accuracy: log.accuracy != null ? Number(log.accuracy) : undefined,
    };
  }

  /** History of the authenticated user (newest first). */
  getMine(limit = 50): Observable<LocationEntry[]> {
    return this.http.get<LocationLogApi[]>(`${this.url}/me`, { params: { limit } }).pipe(
      map(logs => logs.map(log => this.mapLocationLogToEntry(log)))
    );
  }

  /** Asks the phone (silent push) to send its current location. */
  requestFromPhone(): Observable<{ phones: number; requestedAt: string }> {
    return this.http
      .post<{ celulares: number; solicitadoEn: string }>(`${this.url}/me/request`, {})
      .pipe(map((r) => ({ phones: r.celulares, requestedAt: r.solicitadoEn })));
  }

  /** Last location the phone sent (null if it never sent one). */
  getLatest(): Observable<LocationEntry | null> {
    return this.http.get<LocationLogApi | null>(`${this.url}/me/latest`).pipe(
      map(log => (log ? this.mapLocationLogToEntry(log) : null))
    );
  }

  // Used by USER: only her own location history
  getByUser(userId: number): Observable<LocationEntry[]> {
    return this.http.get<LocationLogApi[]>(`${this.url}/user/${userId}`).pipe(
      map(logs => logs.map(log => this.mapLocationLogToEntry(log)))
    );
  }
}