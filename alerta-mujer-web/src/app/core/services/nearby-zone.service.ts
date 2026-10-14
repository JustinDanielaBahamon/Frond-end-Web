import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NearbyZone } from '../models/nearby-zone.model';

interface ZoneApi {
  id: number;
  name: string;
  zoneType: string;
  riskLevel: string;
  description?: string;
  address?: string;
  city?: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class NearbyZoneService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/zones`;

  getByUser(_userId: number): Observable<NearbyZone[]> {
    return this.http.get<ZoneApi[]>(this.baseUrl).pipe(
      map(zones => zones
        .filter(z => z.isActive !== false)
        .map(z => ({
          id: z.id,
          name: z.name,
          type: normalizarTipo(z.zoneType),
          description: z.description,
          address: z.address,
          city: z.city,
          lat: z.latitude,
          lng: z.longitude,
          radiusMeters: z.radiusMeters,
          riskLevel: z.riskLevel,
          isActive: z.isActive,
        }))
      )
    );
  }
}

// Conserva el tipo real (antes todo lo que no era 'safe' se volvía 'risk', y una
// estación de policía o un punto de asistencia aparecían como "zona de riesgo").
const TIPOS: NearbyZone['type'][] = ['safe', 'risk', 'help', 'policia', 'asistencia'];
function normalizarTipo(zoneType: string): NearbyZone['type'] {
  const t = (zoneType ?? '').toLowerCase() as NearbyZone['type'];
  return TIPOS.includes(t) ? t : 'risk';
}
