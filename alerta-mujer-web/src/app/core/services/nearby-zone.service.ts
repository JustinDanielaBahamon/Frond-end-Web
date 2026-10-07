import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { NearbyZone, ZoneType } from '../models/nearby-zone.model';

@Injectable({ providedIn: 'root' })
export class NearbyZoneService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/zones`;

  // Las zonas son globales (las crea el admin); userId no se manda al backend.
  getByUser(_userId: number): Observable<NearbyZone[]> {
    return this.http
      .get<any[]>(this.baseUrl)
      .pipe(map((lista) => lista.map((item) => this.normalizar(item))));
  }

  /** Adapta la entidad Zone (zoneType, latitude, longitude, radiusMeters)
   *  al modelo de la web. La distancia se calcula en el componente. */
  private normalizar(z: any): NearbyZone {
    return {
      id: Number(z.id ?? 0),
      name: z.name ?? 'Sin nombre',
      type: this.mapearTipo(z.zoneType ?? z.type),
      description: z.description ?? '',
      address: z.address ?? '',
      city: z.city ?? '',
      riskLevel: z.riskLevel,
      lat: Number(z.latitude ?? z.lat ?? 0),
      lng: Number(z.longitude ?? z.lng ?? 0),
      radiusMeters: Number(z.radiusMeters ?? 0),
    };
  }

  private mapearTipo(valor: unknown): ZoneType {
    const v = String(valor ?? '').toLowerCase();
    if (v === 'safe' || v === 'segura') return 'safe';
    // Un tipo desconocido se muestra como riesgo: es la opción conservadora.
    return 'risk';
  }
}
