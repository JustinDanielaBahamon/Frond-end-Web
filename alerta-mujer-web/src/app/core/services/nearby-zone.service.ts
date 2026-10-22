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
          type: normalizeType(z.zoneType),
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

// Keeps the real type (before, everything that was not 'safe' became 'risk', and a
// police station or an assistance point showed up as a "risk zone").
const TYPES: NearbyZone['type'][] = ['safe', 'risk', 'help', 'policia', 'asistencia'];
function normalizeType(zoneType: string): NearbyZone['type'] {
  const t = (zoneType ?? '').toLowerCase() as NearbyZone['type'];
  return TYPES.includes(t) ? t : 'risk';
}
