import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { UbicacionEntry } from '../../core/models/location.model';

@Injectable({ providedIn: 'root' })
export class PhoneLocationService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/location-logs`;

  // Usado por ADMIN: todas las ubicaciones
  getAll(): Observable<UbicacionEntry[]> {
    return this.http.get<UbicacionEntry[]>(this.url).pipe(
      map((lista: any[]) => lista.map((item) => this.adaptar(item)))
    );
  }

  // Usado por USUARIA: solo su propio historial de ubicaciones
  getByUsuario(usuarioId: number): Observable<UbicacionEntry[]> {
    return this.http.get<any[]>(`${this.url}/user/${usuarioId}`).pipe(
      map((lista) => lista.map((item) => this.adaptar(item)))
    );
  }

  private adaptar(item: any): UbicacionEntry {
    const recordedAt = item.recordedAt ?? item.recorded_at ?? '';
    const lat = item.latitude != null ? Number(item.latitude) : Number(item.lat ?? 0);
    const lng = item.longitude != null ? Number(item.longitude) : Number(item.lng ?? 0);
    return {
      id: String(item.id ?? ''),
      usuarioId: Number(item.userProfileId ?? item.user_profile_id ?? 0),
      time: recordedAt ? new Date(recordedAt).toLocaleTimeString('es-CO', {hour: '2-digit', minute: '2-digit'}) : '',
      address: `${item.deviceName ?? item.device_name ?? ''}`.trim() || '',
      gpsSignal: item.accuracy != null && Number(item.accuracy) <= 15 ? 'Fuerte' : 'Moderada',
      battery: 0,
      lat,
      lng,
      date: recordedAt ? recordedAt.substring(0, 10) : undefined,
      recordedAt: recordedAt || undefined,
    };
  }
}