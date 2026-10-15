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

  /** Zonas de riesgo para el mapa de alertas (los puntos de apoyo no se dibujan como riesgo). */
  getZonas(): Observable<ZonaManual[]> {
    return this.http.get<ZonaApi[]>(this.zonasUrl).pipe(
      map(zonas => zonas.filter(z => z.zoneType === 'risk' && z.isActive !== false).map(zonaDesdeApi))
    );
  }

  createZona(zona: Omit<ZonaManual, 'id'>): Observable<ZonaManual> {
    return this.http.post<ZonaApi>(this.zonasUrl, zonaHaciaApi(zona)).pipe(map(zonaDesdeApi));
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

/** Campos de /api/zones que usa el mapa de alertas. */
interface ZonaApi {
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

const NIVEL_DESDE_API: Record<string, ZonaManual['nivel']> = { high: 'Alto', medium: 'Medio', low: 'Bajo' };
const NIVEL_HACIA_API: Record<ZonaManual['nivel'], string> = { Alto: 'high', Medio: 'medium', Bajo: 'low' };

function zonaDesdeApi(z: ZonaApi): ZonaManual {
  const radio = Number(z.radiusMeters);
  return {
    id: z.id,
    nombre: z.name,
    nivel: NIVEL_DESDE_API[z.riskLevel] ?? 'Medio',
    metodo: radio > RADIO_PIN ? 'area' : 'pin',
    radio: radio > RADIO_PIN ? radio : undefined,
    centroLat: Number(z.latitude),
    centroLng: Number(z.longitude),
    alertasEnZona: 0,
  };
}

function zonaHaciaApi(z: Omit<ZonaManual, 'id'>): Omit<ZonaApi, 'id'> {
  return {
    name: z.nombre,
    zoneType: 'risk',
    riskLevel: NIVEL_HACIA_API[z.nivel] ?? 'medium',
    // El mapa no pide ciudad; se puede corregir luego en Gestión de zonas.
    city: 'Sin especificar',
    latitude: z.centroLat,
    longitude: z.centroLng,
    radiusMeters: z.metodo === 'area' && z.radio ? z.radio : RADIO_PIN,
    isActive: true,
  };
}

/** Distancia en metros entre dos coordenadas (fórmula del haversine). */
function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** True si la coordenada cae dentro del radio de la zona. Las coordenadas 0,0 se consideran "sin ubicación". */
export function estaDentroDeZona(z: ZonaManual, lat: number, lng: number): boolean {
  if (!lat && !lng) return false;
  return distanciaMetros(z.centroLat, z.centroLng, lat, lng) <= (z.radio ?? RADIO_PIN);
}

/** Llena alertasEnZona de cada zona con las alertas que caen dentro de su radio. */
export function contarAlertasEnZonas(zonas: ZonaManual[], alertas: { lat: number; lng: number }[]): ZonaManual[] {
  return zonas.map(z => ({ ...z, alertasEnZona: alertas.filter(a => estaDentroDeZona(z, a.lat, a.lng)).length }));
}
