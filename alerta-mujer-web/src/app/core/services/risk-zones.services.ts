import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ManualZone, MapPoint, PointType, POINT_TYPES } from '../models/zona.model';

@Injectable({ providedIn: 'root' })
export class RiskZonesService {
  private http = inject(HttpClient);
  private zonesUrl = `${environment.apiUrl}/api/zones`;
  // Los puntos de apoyo del mapa (CAI, hospitales, bomberos...) son recursos de emergencia del backend.
  private resourcesUrl = `${environment.apiUrl}/api/resources`;

  /** Zonas de riesgo para el mapa de alertas (los puntos de apoyo no se dibujan como riesgo). */
  getZones(): Observable<ManualZone[]> {
    return this.http.get<ZoneApi[]>(this.zonesUrl).pipe(
      map(zones => zones.filter(z => z.zoneType === 'risk' && z.isActive !== false).map(zoneFromApi))
    );
  }

  createZone(zone: Omit<ManualZone, 'id'>): Observable<ManualZone> {
    return this.http.post<ZoneApi>(this.zonesUrl, zoneToApi(zone)).pipe(map(zoneFromApi));
  }

  deleteZone(id: number): Observable<void> {
    return this.http.delete<void>(`${this.zonesUrl}/${id}`);
  }

  getPoints(): Observable<MapPoint[]> {
    return this.http.get<ResourceApi[]>(this.resourcesUrl).pipe(
      map(resources => resources
        .filter(r => r.resourceType in POINT_TYPES && r.latitude != null && r.longitude != null)
        .map(r => ({
          id: r.id,
          type: r.resourceType as PointType,
          name: r.name,
          lat: Number(r.latitude),
          lng: Number(r.longitude),
        })))
    );
  }

  createPoint(point: Omit<MapPoint, 'id'>): Observable<MapPoint> {
    const resource = {
      name: point.name,
      resourceType: point.type,
      city: 'Sin especificar',
      latitude: point.lat,
      longitude: point.lng,
    };
    return this.http.post<ResourceApi>(this.resourcesUrl, resource).pipe(
      map(r => ({ id: r.id, type: point.type, name: r.name, lat: Number(r.latitude), lng: Number(r.longitude) }))
    );
  }
}

/** Campos de /api/resources que usa el mapa. */
interface ResourceApi {
  id: number;
  name: string;
  resourceType: string;
  latitude: number | null;
  longitude: number | null;
}


/** Campos de /api/zones que usa el mapa de alertas. */
interface ZoneApi {
  id: number;
  name: string;
  zoneType: string;
  riskLevel: string;
  city: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive?: boolean;
}

// Una zona "pin" se guarda con un radio pequeño, porque el backend exige radio.
const RADIO_PIN = 50;

const LEVEL_FROM_API: Record<string, ManualZone['level']> = { high: 'Alto', medium: 'Medio', low: 'Bajo' };
const LEVEL_TO_API: Record<ManualZone['level'], string> = { Alto: 'high', Medio: 'medium', Bajo: 'low' };

function zoneFromApi(z: ZoneApi): ManualZone {
  const radio = Number(z.radiusMeters);
  return {
    id: z.id,
    name: z.name,
    level: LEVEL_FROM_API[z.riskLevel] ?? 'Medio',
    method: radio > RADIO_PIN ? 'area' : 'pin',
    radio: radio > RADIO_PIN ? radio : undefined,
    centerLat: Number(z.latitude),
    centerLng: Number(z.longitude),
    alertsInZone: 0,
  };
}

function zoneToApi(z: Omit<ManualZone, 'id'>): Omit<ZoneApi, 'id'> {
  return {
    name: z.name,
    zoneType: 'risk',
    riskLevel: LEVEL_TO_API[z.level] ?? 'medium',
    // El mapa no pide ciudad; se puede corregir luego en Gestión de zonas.
    city: 'Sin especificar',
    latitude: z.centerLat,
    longitude: z.centerLng,
    radiusMeters: z.method === 'area' && z.radio ? z.radio : RADIO_PIN,
    isActive: true,
  };
}

/** Distancia en metros entre dos coordenadas (fórmula del haversine). */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** True si la coordenada cae dentro del radio de la zona. Las coordenadas 0,0 se consideran "sin ubicación". */
export function isInsideZone(z: ManualZone, lat: number, lng: number): boolean {
  if (!lat && !lng) return false;
  return distanceMeters(z.centerLat, z.centerLng, lat, lng) <= (z.radio ?? RADIO_PIN);
}

/** Llena alertasEnZona de cada zona con las alertas que caen dentro de su radio. */
export function countAlertsInZones(zones: ManualZone[], alerts: { lat: number; lng: number }[]): ManualZone[] {
  return zones.map(z => ({ ...z, alertsInZone: alerts.filter(a => isInsideZone(z, a.lat, a.lng)).length }));
}
