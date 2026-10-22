import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

import { ZoneType, Zone } from '../models/zone-management-model';

/** Zone as the backend returns and receives it (/api/zones). */
interface ZoneApi {
  id: number;
  name: string;
  zoneType: string;   // risk | safe | help | policia | asistencia
  riskLevel: string;  // low | medium | high
  description?: string | null;
  address?: string | null;
  city: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string | null;
}

const DEFAULT_RADIUS = 150;

/** Backend zoneType + riskLevel → type the panel shows. */
function typeFromApi(z: ZoneApi): ZoneType {
  if (z.zoneType !== 'risk') return 'Segura';  // safe, help, policia and asistencia are support points
  if (z.riskLevel === 'high') return 'Riesgo Alto';
  if (z.riskLevel === 'medium') return 'Riesgo Medio';
  return 'Riesgo Bajo';
}

function typeToApi(type: ZoneType): Pick<ZoneApi, 'zoneType' | 'riskLevel'> {
  switch (type) {
    case 'Riesgo Alto': return { zoneType: 'risk', riskLevel: 'high' };
    case 'Riesgo Medio': return { zoneType: 'risk', riskLevel: 'medium' };
    case 'Riesgo Bajo': return { zoneType: 'risk', riskLevel: 'low' };
    default: return { zoneType: 'safe', riskLevel: 'low' };
  }
}

function fromApi(z: ZoneApi): Zone {
  return {
    id: String(z.id),
    name: z.name,
    city: z.city,
    type: typeFromApi(z),
    alerts: 0,
    // The backend only stores active/inactive; "Revisión" is stored as inactive.
    status: z.isActive ? 'Activa' : 'Inactiva',
    updated_at: z.updatedAt ?? z.createdAt ?? '',
    lat: z.latitude != null ? Number(z.latitude) : undefined,
    lng: z.longitude != null ? Number(z.longitude) : undefined,
    radio: z.radiusMeters != null ? Number(z.radiusMeters) : undefined,
  };
}

/**
 * Body for POST/PUT. The backend PUT replaces every field, so it starts from the
 * original zone (description, address and exact type like "policia") and applies the changes.
 */
function toApi(changes: Partial<Zone>, original?: ZoneApi): Omit<ZoneApi, 'id'> {
  const { id: _id, ...base }: ZoneApi = original ?? {
    id: 0, name: '', zoneType: 'safe', riskLevel: 'low', city: '',
    latitude: 0, longitude: 0, radiusMeters: DEFAULT_RADIUS, isActive: true,
  };

  const originalType = original ? typeFromApi(original) : undefined;
  const changeType = changes.type && changes.type !== originalType ? typeToApi(changes.type) : {};

  return {
    ...base,
    ...changeType,
    ...(changes.name !== undefined && { name: changes.name }),
    ...(changes.city !== undefined && { city: changes.city }),
    ...(changes.status !== undefined && { isActive: changes.status === 'Activa' }),
    ...(changes.lat != null && { latitude: changes.lat }),
    ...(changes.lng != null && { longitude: changes.lng }),
    ...(changes.radio != null && { radiusMeters: changes.radio }),
  };
}

@Injectable({ providedIn: 'root' })
export class ZonesService {

  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // Latest version of each zone according to the backend, so no fields are lost when editing.
  private originals = new Map<string, ZoneApi>();

  private remember = (z: ZoneApi) => { this.originals.set(String(z.id), z); };

  getAll(): Observable<Zone[]> {
    return this.http.get<ZoneApi[]>(`${this.apiUrl}/api/zones`).pipe(
      tap(list => list.forEach(this.remember)),
      map(list => list.map(fromApi)),
    );
  }

  create(zone: Omit<Zone, 'id'>): Observable<Zone> {
    return this.http.post<ZoneApi>(`${this.apiUrl}/api/zones`, toApi(zone)).pipe(
      tap(this.remember),
      map(fromApi),
    );
  }

  update(id: string, changes: Partial<Omit<Zone, 'id'>>): Observable<Zone> {
    return this.http.put<ZoneApi>(`${this.apiUrl}/api/zones/${id}`, toApi(changes, this.originals.get(id))).pipe(
      tap(this.remember),
      map(fromApi),
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/zones/${id}`).pipe(
      tap(() => this.originals.delete(id)),
    );
  }
}
