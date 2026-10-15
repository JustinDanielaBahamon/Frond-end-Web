import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ZonaManual, PuntoMapa } from '../models/zona.model';

@Injectable({ providedIn: 'root' })
export class RiskZonesService {
  private http = inject(HttpClient);
  private zonasUrl = `${environment.apiUrl}/api/zones`;
  // Los puntos CAI / Hospital del mapa son recursos de emergencia del backend.
  private recursosUrl = `${environment.apiUrl}/api/resources`;

  getZonas(): Observable<ZonaManual[]> {
    return this.http.get<ZonaManual[]>(this.zonasUrl);
  }

  createZona(zona: Omit<ZonaManual, 'id'>): Observable<ZonaManual> {
    return this.http.post<ZonaManual>(this.zonasUrl, zona);
  }

  deleteZona(id: number): Observable<void> {
    return this.http.delete<void>(`${this.zonasUrl}/${id}`);
  }

  getPuntos(): Observable<PuntoMapa[]> {
    return this.http.get<RecursoApi[]>(this.recursosUrl).pipe(
      map(recursos => recursos
        .map(r => ({ r, tipo: TIPO_PUNTO[r.resourceType] }))
        .filter(({ r, tipo }) => tipo && r.latitude != null && r.longitude != null)
        .map(({ r, tipo }) => ({
          id: r.id,
          tipo: tipo!,
          nombre: r.name,
          lat: Number(r.latitude),
          lng: Number(r.longitude),
        })))
    );
  }

  createPunto(punto: Omit<PuntoMapa, 'id'>): Observable<PuntoMapa> {
    const recurso = {
      name: punto.nombre,
      resourceType: punto.tipo === 'CAI' ? 'police_post' : 'hospital',
      city: 'Sin especificar',
      latitude: punto.lat,
      longitude: punto.lng,
    };
    return this.http.post<RecursoApi>(this.recursosUrl, recurso).pipe(
      map(r => ({ id: r.id, tipo: punto.tipo, nombre: r.name, lat: Number(r.latitude), lng: Number(r.longitude) }))
    );
  }
}

/** Campos de /api/resources que usa el mapa. */
interface RecursoApi {
  id: number;
  name: string;
  resourceType: string;
  latitude: number | null;
  longitude: number | null;
}

const TIPO_PUNTO: Record<string, PuntoMapa['tipo'] | undefined> = {
  police_post: 'CAI',
  police_station: 'CAI',
  hospital: 'Hospital',
  health_center: 'Hospital',
};
