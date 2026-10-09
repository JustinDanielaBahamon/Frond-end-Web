import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UbicacionEntry, LocationLogApi } from '../../core/models/location.model';

@Injectable({ providedIn: 'root' })
export class PhoneLocationService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/location-logs`;

  // Transforma LocationLogApi del backend a UbicacionEntry del frontend
  private mapLocationLogToEntry(log: LocationLogApi): UbicacionEntry {
    const date = new Date(log.recordedAt);
    return {
      id: log.id,
      usuarioId: log.userProfileId,
      time: date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      address: 'Ubicación registrada', // El backend no tiene dirección, se puede agregar geocoding
      gpsSignal: 'Fuerte', // El backend no tiene señal GPS, valor por defecto
      battery: 100, // El backend no tiene batería, valor por defecto
      lat: log.latitude,
      lng: log.longitude,
      date: date.toISOString().split('T')[0],
    };
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