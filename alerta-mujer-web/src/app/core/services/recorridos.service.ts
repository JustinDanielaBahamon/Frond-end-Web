import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface GpsPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
}

/** Recorrido tal como lo usa la UI (misma forma que en la app móvil). */
export interface SavedRoute {
  id: number;
  fecha: string;
  estimatedTime: string;
  estimatedDistance: string;
  startNeighborhood: string;
  endNeighborhood: string;
  municipality: string;
  department: string;
  country: string;
  puntos: GpsPoint[];
  pointCount: number;
  esManual: boolean;
  customName?: string;
  important: boolean;
}

export interface NewRoute {
  nombre: string;
  start: string;
  end: string;
  puntos: GpsPoint[];
  distanceKm: number;
  estimatedMinutes: number;
  municipality?: string;
  department?: string;
  country?: string;
}

export interface ServiceResult {
  ok: boolean;
  error?: string;
}

/** Forma del backend (/api/saved-routes). */
interface SavedRouteApi {
  id: number;
  name: string;
  startLabel?: string;
  endLabel?: string;
  city?: string;
  department?: string;
  country?: string;
  distanceKm?: number;
  estimatedMinutes?: number;
  points: GpsPoint[];
  isStarred: boolean;
  isManual: boolean;
  createdAt: string;
}

// Reglas de negocio (iguales en móvil y backend; el backend es quien las garantiza)
const MAX_ROUTES = 4;
const MAX_STARRED = 2;

// Versión anterior: los recorridos vivían solo en este navegador
const LEGACY_STORAGE_KEY = 'alerta_mujer_recorridos';

@Injectable({ providedIn: 'root' })
export class RoutesService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/saved-routes`;

  private routes = signal<SavedRoute[]>([]);
  readonly loading = signal(false);

  get routes$() {
    return this.routes;
  }

  get routeLimit(): number {
    return MAX_ROUTES;
  }

  get starLimit(): number {
    return MAX_STARRED;
  }

  /** Carga los recorridos de la usuaria y sube (una sola vez) los que hubiera en localStorage. */
  async load(): Promise<ServiceResult> {
    this.loading.set(true);
    try {
      await this.migrateLocal();
      await this.refresh();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: this.errorMessage(err, 'No se pudieron cargar tus recorridos.') };
    } finally {
      this.loading.set(false);
    }
  }

  async addRoute(newOne: NewRoute): Promise<ServiceResult> {
    if (this.routes().length >= MAX_ROUTES) {
      return { ok: false, error: `Solo puedes tener ${MAX_ROUTES} recorridos guardados. Elimina uno para crear otro.` };
    }
    try {
      const created = await firstValueFrom(this.http.post<SavedRouteApi>(this.baseUrl, this.toApi(newOne)));
      this.routes.update((prev) => [this.fromApi(created), ...prev]);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: this.errorMessage(err, 'No se pudo guardar el recorrido.') };
    }
  }

  async deleteRoute(id: number): Promise<ServiceResult> {
    try {
      await firstValueFrom(this.http.delete<void>(`${this.baseUrl}/${id}`));
      this.routes.update((prev) => prev.filter((r) => r.id !== id));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: this.errorMessage(err, 'No se pudo eliminar el recorrido.') };
    }
  }

  async toggleImportant(id: number): Promise<ServiceResult> {
    const target = this.routes().find((r) => r.id === id);
    if (!target) {
      return { ok: false, error: 'Recorrido no encontrado.' };
    }
    if (!target.important && this.routes().filter((r) => r.important).length >= MAX_STARRED) {
      return { ok: false, error: `Solo puedes tener ${MAX_STARRED} recorridos estrella. Quita la estrella a otro para marcar este.` };
    }
    try {
      const updated = await firstValueFrom(
        this.http.patch<SavedRouteApi>(`${this.baseUrl}/${id}`, { isStarred: !target.important })
      );
      this.replace(this.fromApi(updated));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: this.errorMessage(err, 'No se pudo actualizar el recorrido.') };
    }
  }

  private async refresh(): Promise<void> {
    const list = await firstValueFrom(this.http.get<SavedRouteApi[]>(`${this.baseUrl}/me`));
    this.routes.set(list.map((r) => this.fromApi(r)));
  }

  private replace(route: SavedRoute): void {
    this.routes.update((prev) => prev.map((r) => (r.id === route.id ? route : r)));
  }

  /** Sube al backend los recorridos guardados por la versión anterior y limpia localStorage. */
  private async migrateLocal(): Promise<void> {
    let locales: Array<Partial<SavedRoute>> = [];
    try {
      locales = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) ?? '[]');
    } catch {
      locales = [];
    }
    if (!Array.isArray(locales) || locales.length === 0) return;

    for (const r of locales) {
      if (!r.puntos || r.puntos.length < 2) continue;
      try {
        await firstValueFrom(
          this.http.post(this.baseUrl, {
            name: r.customName || `Ruta ${r.startNeighborhood ?? 'A'} → ${r.endNeighborhood ?? 'B'}`,
            startLabel: r.startNeighborhood,
            endLabel: r.endNeighborhood,
            city: r.municipality,
            department: r.department,
            country: r.country,
            distanceKm: parseFloat(String(r.estimatedDistance ?? '')) || null,
            points: r.puntos,
            isManual: r.esManual ?? true,
          })
        );
      } catch (err) {
        // Límite de 4 alcanzado: el resto no cabe
        if (err instanceof HttpErrorResponse && err.status === 409) break;
      }
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }

  private toApi(newOne: NewRoute): Partial<SavedRouteApi> {
    return {
      name: newOne.nombre,
      startLabel: newOne.start,
      endLabel: newOne.end,
      city: newOne.municipality,
      department: newOne.department,
      country: newOne.country,
      distanceKm: Math.round(newOne.distanceKm * 100) / 100,
      estimatedMinutes: newOne.estimatedMinutes,
      points: newOne.puntos,
      isManual: true,
    };
  }

  private fromApi(api: SavedRouteApi): SavedRoute {
    return {
      id: api.id,
      fecha: api.createdAt,
      estimatedTime: formatMinutes(api.estimatedMinutes),
      estimatedDistance: api.distanceKm != null ? `${Number(api.distanceKm).toFixed(2)} km` : '—',
      startNeighborhood: api.startLabel ?? 'Inicio',
      endNeighborhood: api.endLabel ?? 'Fin',
      municipality: api.city ?? '',
      department: api.department ?? '',
      country: api.country ?? '',
      puntos: api.points ?? [],
      pointCount: api.points?.length ?? 0,
      esManual: api.isManual,
      customName: api.name,
      important: api.isStarred,
    };
  }

  private errorMessage(err: unknown, byDefault: string): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) return 'No hay conexión con el servidor.';
      if ((err.status === 409 || err.status === 400) && err.error?.message) return err.error.message;
    }
    return byDefault;
  }
}

function formatMinutes(minutos?: number): string {
  if (minutos == null) return '—';
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)}h ${minutos % 60}min`;
}
