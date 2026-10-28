import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ZoneType, Zone } from '../models/zone-management-model';
import { ManualZone } from '../models/map-zone.model';
import { NearbyZone } from '../models/nearby-zone.model';

/**
 * Zones of /api/zones, for the three places that show them:
 *  - Zone management (admin): full CRUD, keeping every backend field when editing;
 *  - alerts map (admin): only the risk zones, drawn as an area or a pin;
 *  - the user's panel: the active zones near her, with their real type.
 */

/** Zone as the backend returns and receives it. */
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
// A "pin" zone is stored with a small radius, because the backend requires a radius.
const PIN_RADIUS = 50;

// ── Zone management ──

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

// ── Alerts map ──

const LEVEL_FROM_API: Record<string, ManualZone['level']> = { high: 'Alto', medium: 'Medio', low: 'Bajo' };
const LEVEL_TO_API: Record<ManualZone['level'], string> = { Alto: 'high', Medio: 'medium', Bajo: 'low' };

function riskZoneFromApi(z: ZoneApi): ManualZone {
  const radio = Number(z.radiusMeters);
  return {
    id: z.id,
    name: z.name,
    level: LEVEL_FROM_API[z.riskLevel] ?? 'Medio',
    method: radio > PIN_RADIUS ? 'area' : 'pin',
    radio: radio > PIN_RADIUS ? radio : undefined,
    centerLat: Number(z.latitude),
    centerLng: Number(z.longitude),
    alertsInZone: 0,
  };
}

function riskZoneToApi(z: Omit<ManualZone, 'id'>): Omit<ZoneApi, 'id'> {
  return {
    name: z.name,
    zoneType: 'risk',
    riskLevel: LEVEL_TO_API[z.level] ?? 'medium',
    // The map does not ask for a city; it can be fixed later in Zone management.
    city: 'Sin especificar',
    latitude: z.centerLat,
    longitude: z.centerLng,
    radiusMeters: z.method === 'area' && z.radio ? z.radio : PIN_RADIUS,
    isActive: true,
  };
}

/** Distance in meters between two coordinates (haversine formula). */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** True if the coordinate falls inside the zone radius. Coordinates 0,0 are considered "no location". */
export function isInsideZone(z: ManualZone, lat: number, lng: number): boolean {
  if (!lat && !lng) return false;
  return distanceMeters(z.centerLat, z.centerLng, lat, lng) <= (z.radio ?? PIN_RADIUS);
}

/** Fills alertsInZone of each zone with the alerts that fall inside its radius. */
export function countAlertsInZones(zones: ManualZone[], alerts: { lat: number; lng: number }[]): ManualZone[] {
  return zones.map(z => ({ ...z, alertsInZone: alerts.filter(a => isInsideZone(z, a.lat, a.lng)).length }));
}

// ── The user's panel ──

// Keeps the real type (before, everything that was not 'safe' became 'risk', and a
// police station or an assistance point showed up as a "risk zone").
const TYPES: NearbyZone['type'][] = ['safe', 'risk', 'help', 'policia', 'asistencia'];
function normalizeType(zoneType: string): NearbyZone['type'] {
  const t = (zoneType ?? '').toLowerCase() as NearbyZone['type'];
  return TYPES.includes(t) ? t : 'risk';
}

@Injectable({ providedIn: 'root' })
export class ZonesService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/zones`;

  // Latest version of each zone according to the backend, so no fields are lost when editing.
  private originals = new Map<string, ZoneApi>();

  private remember = (z: ZoneApi) => { this.originals.set(String(z.id), z); };

  // ── Zone management (admin) ──

  getAll(): Observable<Zone[]> {
    return this.http.get<ZoneApi[]>(this.url).pipe(
      tap(list => list.forEach(this.remember)),
      map(list => list.map(fromApi)),
    );
  }

  create(zone: Omit<Zone, 'id'>): Observable<Zone> {
    return this.http.post<ZoneApi>(this.url, toApi(zone)).pipe(
      tap(this.remember),
      map(fromApi),
    );
  }

  update(id: string, changes: Partial<Omit<Zone, 'id'>>): Observable<Zone> {
    return this.http.put<ZoneApi>(`${this.url}/${id}`, toApi(changes, this.originals.get(id))).pipe(
      tap(this.remember),
      map(fromApi),
    );
  }

  delete(id: string | number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.originals.delete(String(id))),
    );
  }

  // ── Alerts map (admin): risk zones only; support points are not drawn as risk ──

  getRiskZones(): Observable<ManualZone[]> {
    return this.http.get<ZoneApi[]>(this.url).pipe(
      map(zones => zones.filter(z => z.zoneType === 'risk' && z.isActive !== false).map(riskZoneFromApi))
    );
  }

  createRiskZone(zone: Omit<ManualZone, 'id'>): Observable<ManualZone> {
    return this.http.post<ZoneApi>(this.url, riskZoneToApi(zone)).pipe(map(riskZoneFromApi));
  }

  // ── The user's panel: active zones with their real type ──

  getNearby(): Observable<NearbyZone[]> {
    return this.http.get<ZoneApi[]>(this.url).pipe(
      map(zones => zones
        .filter(z => z.isActive !== false)
        .map(z => ({
          id: z.id,
          name: z.name,
          type: normalizeType(z.zoneType),
          description: z.description ?? undefined,
          address: z.address ?? undefined,
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
