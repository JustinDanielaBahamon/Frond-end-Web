import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

import { ZoneType, Zone } from '../models/zone-management-model';

/** Zona tal como la devuelve y la recibe el backend (/api/zones). */
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

/** zoneType + riskLevel del backend → tipo que muestra el panel. */
function typeFromApi(z: ZoneApi): ZoneType {
  if (z.zoneType !== 'risk') return 'Segura';  // safe, help, policia y asistencia son puntos de apoyo
  if (z.riskLevel === 'high') return 'Riesgo Alto';
  if (z.riskLevel === 'medium') return 'Riesgo Medio';
  return 'Riesgo Bajo';
}

function typeToApi(tipo: ZoneType): Pick<ZoneApi, 'zoneType' | 'riskLevel'> {
  switch (tipo) {
    case 'Riesgo Alto': return { zoneType: 'risk', riskLevel: 'high' };
    case 'Riesgo Medio': return { zoneType: 'risk', riskLevel: 'medium' };
    case 'Riesgo Bajo': return { zoneType: 'risk', riskLevel: 'low' };
    default: return { zoneType: 'safe', riskLevel: 'low' };
  }
}

function fromApi(z: ZoneApi): Zone {
  return {
    id: String(z.id),
    nombre: z.name,
    city: z.city,
    tipo: typeFromApi(z),
    alerts: 0,
    // El backend solo guarda activa/inactiva; "Revisión" se guarda como inactiva.
    estado: z.isActive ? 'Activa' : 'Inactiva',
    updated_at: z.updatedAt ?? z.createdAt ?? '',
    lat: z.latitude != null ? Number(z.latitude) : undefined,
    lng: z.longitude != null ? Number(z.longitude) : undefined,
    radio: z.radiusMeters != null ? Number(z.radiusMeters) : undefined,
  };
}

/**
 * Cuerpo para POST/PUT. El PUT del backend reemplaza todos los campos, así que se parte de la
 * zona original (descripción, dirección y tipo exacto como "policia") y se aplican los cambios.
 */
function toApi(changes: Partial<Zone>, original?: ZoneApi): Omit<ZoneApi, 'id'> {
  const { id: _id, ...base }: ZoneApi = original ?? {
    id: 0, name: '', zoneType: 'safe', riskLevel: 'low', city: '',
    latitude: 0, longitude: 0, radiusMeters: DEFAULT_RADIUS, isActive: true,
  };

  const originalType = original ? typeFromApi(original) : undefined;
  const changeType = changes.tipo && changes.tipo !== originalType ? typeToApi(changes.tipo) : {};

  return {
    ...base,
    ...changeType,
    ...(changes.nombre !== undefined && { name: changes.nombre }),
    ...(changes.city !== undefined && { city: changes.city }),
    ...(changes.estado !== undefined && { isActive: changes.estado === 'Activa' }),
    ...(changes.lat != null && { latitude: changes.lat }),
    ...(changes.lng != null && { longitude: changes.lng }),
    ...(changes.radio != null && { radiusMeters: changes.radio }),
  };
}

@Injectable({ providedIn: 'root' })
export class ZonesService {

  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // Última versión de cada zona según el backend, para no perder campos al editar.
  private originales = new Map<string, ZoneApi>();

  private remember = (z: ZoneApi) => { this.originales.set(String(z.id), z); };

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
    return this.http.put<ZoneApi>(`${this.apiUrl}/api/zones/${id}`, toApi(changes, this.originales.get(id))).pipe(
      tap(this.remember),
      map(fromApi),
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/zones/${id}`).pipe(
      tap(() => this.originales.delete(id)),
    );
  }
}
