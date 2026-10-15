import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

import { TipoZona, Zona } from '../models/zone-management-model';

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

const RADIO_POR_DEFECTO = 150;

/** zoneType + riskLevel del backend → tipo que muestra el panel. */
function tipoDesdeApi(z: ZoneApi): TipoZona {
  if (z.zoneType !== 'risk') return 'Segura';  // safe, help, policia y asistencia son puntos de apoyo
  if (z.riskLevel === 'high') return 'Riesgo Alto';
  if (z.riskLevel === 'medium') return 'Riesgo Medio';
  return 'Riesgo Bajo';
}

function tipoHaciaApi(tipo: TipoZona): Pick<ZoneApi, 'zoneType' | 'riskLevel'> {
  switch (tipo) {
    case 'Riesgo Alto': return { zoneType: 'risk', riskLevel: 'high' };
    case 'Riesgo Medio': return { zoneType: 'risk', riskLevel: 'medium' };
    case 'Riesgo Bajo': return { zoneType: 'risk', riskLevel: 'low' };
    default: return { zoneType: 'safe', riskLevel: 'low' };
  }
}

function desdeApi(z: ZoneApi): Zona {
  return {
    id: String(z.id),
    nombre: z.name,
    ciudad: z.city,
    tipo: tipoDesdeApi(z),
    alertas: 0,
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
function haciaApi(cambios: Partial<Zona>, original?: ZoneApi): Omit<ZoneApi, 'id'> {
  const { id: _id, ...base }: ZoneApi = original ?? {
    id: 0, name: '', zoneType: 'safe', riskLevel: 'low', city: '',
    latitude: 0, longitude: 0, radiusMeters: RADIO_POR_DEFECTO, isActive: true,
  };

  const tipoOriginal = original ? tipoDesdeApi(original) : undefined;
  const tipoCambio = cambios.tipo && cambios.tipo !== tipoOriginal ? tipoHaciaApi(cambios.tipo) : {};

  return {
    ...base,
    ...tipoCambio,
    ...(cambios.nombre !== undefined && { name: cambios.nombre }),
    ...(cambios.ciudad !== undefined && { city: cambios.ciudad }),
    ...(cambios.estado !== undefined && { isActive: cambios.estado === 'Activa' }),
    ...(cambios.lat != null && { latitude: cambios.lat }),
    ...(cambios.lng != null && { longitude: cambios.lng }),
    ...(cambios.radio != null && { radiusMeters: cambios.radio }),
  };
}

@Injectable({ providedIn: 'root' })
export class ZonesService {

  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // Última versión de cada zona según el backend, para no perder campos al editar.
  private originales = new Map<string, ZoneApi>();

  private recordar = (z: ZoneApi) => { this.originales.set(String(z.id), z); };

  getAll(): Observable<Zona[]> {
    return this.http.get<ZoneApi[]>(`${this.apiUrl}/api/zones`).pipe(
      tap(lista => lista.forEach(this.recordar)),
      map(lista => lista.map(desdeApi)),
    );
  }

  crear(zona: Omit<Zona, 'id'>): Observable<Zona> {
    return this.http.post<ZoneApi>(`${this.apiUrl}/api/zones`, haciaApi(zona)).pipe(
      tap(this.recordar),
      map(desdeApi),
    );
  }

  actualizar(id: string, cambios: Partial<Omit<Zona, 'id'>>): Observable<Zona> {
    return this.http.put<ZoneApi>(`${this.apiUrl}/api/zones/${id}`, haciaApi(cambios, this.originales.get(id))).pipe(
      tap(this.recordar),
      map(desdeApi),
    );
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/zones/${id}`).pipe(
      tap(() => this.originales.delete(id)),
    );
  }
}
