import { Injectable } from '@angular/core';

export interface Lugar {
  barrio: string | null;
  direccion: string | null; // vía y número, o nombre del sitio (sin la ciudad)
  ciudad: string | null;
}

// OpenStreetMap (Nominatim): gratis y sin clave, misma fuente que la app móvil.
// Su política pide máximo 1 consulta por segundo, así que las consultas van en cola.
const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const ESPERA_MS = 1100;

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private cache = new Map<string, Promise<Lugar | null>>();
  private cola: Promise<unknown> = Promise.resolve();

  /** Barrio y dirección de un punto. Se cachea por coordenada redondeada (~11 m). */
  obtener(lat: number, lng: number): Promise<Lugar | null> {
    const clave = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const enCache = this.cache.get(clave);
    if (enCache) return enCache;

    const consulta = this.cola.then(() => this.consultar(lat, lng));
    // La siguiente consulta espera a que esta termine y a que pase el intervalo
    this.cola = consulta.catch(() => null).then(() => new Promise((r) => setTimeout(r, ESPERA_MS)));
    this.cache.set(clave, consulta);
    // Si falla, se olvida para poder reintentar más tarde
    consulta.then((r) => { if (!r) this.cache.delete(clave); });
    return consulta;
  }

  private async consultar(lat: number, lng: number): Promise<Lugar | null> {
    try {
      const url = `${NOMINATIM}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const data = await res.json();
      const a = data?.address ?? {};
      const limpiar = (v?: string) => (v && v.trim() ? v.trim() : null);

      const barrio =
        limpiar(a.neighbourhood) ?? limpiar(a.suburb) ?? limpiar(a.quarter) ??
        limpiar(a.city_district) ?? limpiar(a.residential);
      const via = limpiar(a.road);
      const viaConNumero = via ? (a.house_number ? `${via} # ${a.house_number}` : via) : null;
      const nombre = limpiar(data?.name);
      // Si el punto cae sobre un sitio con nombre (colegio, almacén...), se muestra ese nombre
      const direccion = nombre && nombre !== via && nombre !== barrio
        ? (viaConNumero ? `${nombre}, ${viaConNumero}` : nombre)
        : viaConNumero;
      // OSM a veces nombra la ciudad como "Perímetro Urbano Neiva"
      const ciudad = (limpiar(a.city) ?? limpiar(a.town) ?? limpiar(a.village) ?? limpiar(a.municipality))
        ?.replace(/^Perímetro Urbano\s+/i, '') ?? null;

      if (!barrio && !direccion && !ciudad) return null;
      return { barrio, direccion, ciudad };
    } catch {
      return null;
    }
  }
}
