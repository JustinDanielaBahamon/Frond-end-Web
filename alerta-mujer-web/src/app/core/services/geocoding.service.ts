import { Injectable } from '@angular/core';

export interface Place {
  neighborhood: string | null;
  address: string | null; // street and number, or name of the place (without the city)
  city: string | null;
}

// OpenStreetMap (Nominatim): free and keyless, same source as the mobile app.
// Its policy asks for at most 1 request per second, so requests are queued.
const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const WAIT_MS = 1100;

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private cache = new Map<string, Promise<Place | null>>();
  private cola: Promise<unknown> = Promise.resolve();

  /** Neighborhood and address of a point. Cached by rounded coordinate (~11 m). */
  get(lat: number, lng: number): Promise<Place | null> {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const enCache = this.cache.get(key);
    if (enCache) return enCache;

    const query = this.cola.then(() => this.query(lat, lng));
    // The next request waits for this one to finish and for the interval to pass
    this.cola = query.catch(() => null).then(() => new Promise((r) => setTimeout(r, WAIT_MS)));
    this.cache.set(key, query);
    // If it fails, it is forgotten so it can be retried later
    query.then((r) => { if (!r) this.cache.delete(key); });
    return query;
  }

  private async query(lat: number, lng: number): Promise<Place | null> {
    try {
      const url = `${NOMINATIM}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const data = await res.json();
      const a = data?.address ?? {};
      const clear = (v?: string) => (v && v.trim() ? v.trim() : null);

      const neighborhood =
        clear(a.neighbourhood) ?? clear(a.suburb) ?? clear(a.quarter) ??
        clear(a.city_district) ?? clear(a.residential);
      const via = clear(a.road);
      const streetWithNumber = via ? (a.house_number ? `${via} # ${a.house_number}` : via) : null;
      const name = clear(data?.name);
      // If the point falls on a named place (school, store...), that name is shown
      const address = name && name !== via && name !== neighborhood
        ? (streetWithNumber ? `${name}, ${streetWithNumber}` : name)
        : streetWithNumber;
      // OSM sometimes names the city "Perímetro Urbano Neiva"
      const city = (clear(a.city) ?? clear(a.town) ?? clear(a.village) ?? clear(a.municipality))
        ?.replace(/^Perímetro Urbano\s+/i, '') ?? null;

      if (!neighborhood && !address && !city) return null;
      return { neighborhood, address, city };
    } catch {
      return null;
    }
  }
}
