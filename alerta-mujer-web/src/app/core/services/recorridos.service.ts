import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PuntoGPS {
  latitude: number;
  longitude: number;
  timestamp: string;
}

/** Recorrido tal como lo usa la UI (misma forma que en la app móvil). */
export interface Recorrido {
  id: number;
  fecha: string;
  tiempoEstimado: string;
  distanciaEstimada: string;
  barrioInicio: string;
  barrioFin: string;
  municipio: string;
  departamento: string;
  pais: string;
  puntos: PuntoGPS[];
  cantidadPuntos: number;
  esManual: boolean;
  nombrePersonalizado?: string;
  importante: boolean;
}

export interface NuevoRecorrido {
  nombre: string;
  inicio: string;
  fin: string;
  puntos: PuntoGPS[];
  distanciaKm: number;
  minutosEstimados: number;
  municipio?: string;
  departamento?: string;
  pais?: string;
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
  points: PuntoGPS[];
  isStarred: boolean;
  isManual: boolean;
  createdAt: string;
}

// Reglas de negocio (iguales en móvil y backend; el backend es quien las garantiza)
const MAX_RECORRIDOS = 4;
const MAX_ESTRELLAS = 2;

// Versión anterior: los recorridos vivían solo en este navegador
const LEGACY_STORAGE_KEY = 'alerta_mujer_recorridos';

@Injectable({ providedIn: 'root' })
export class RecorridosService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/saved-routes`;

  private recorridos = signal<Recorrido[]>([]);
  readonly cargando = signal(false);

  get recorridos$() {
    return this.recorridos;
  }

  get limiteRecorridos(): number {
    return MAX_RECORRIDOS;
  }

  get limiteEstrellas(): number {
    return MAX_ESTRELLAS;
  }

  /** Carga los recorridos de la usuaria y sube (una sola vez) los que hubiera en localStorage. */
  async cargar(): Promise<ServiceResult> {
    this.cargando.set(true);
    try {
      await this.migrarLocales();
      await this.refrescar();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: this.mensajeError(err, 'No se pudieron cargar tus recorridos.') };
    } finally {
      this.cargando.set(false);
    }
  }

  async agregarRecorrido(nuevo: NuevoRecorrido): Promise<ServiceResult> {
    if (this.recorridos().length >= MAX_RECORRIDOS) {
      return { ok: false, error: `Solo puedes tener ${MAX_RECORRIDOS} recorridos guardados. Elimina uno para crear otro.` };
    }
    try {
      const creado = await firstValueFrom(this.http.post<SavedRouteApi>(this.baseUrl, this.toApi(nuevo)));
      this.recorridos.update((prev) => [this.fromApi(creado), ...prev]);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: this.mensajeError(err, 'No se pudo guardar el recorrido.') };
    }
  }

  async eliminarRecorrido(id: number): Promise<ServiceResult> {
    try {
      await firstValueFrom(this.http.delete<void>(`${this.baseUrl}/${id}`));
      this.recorridos.update((prev) => prev.filter((r) => r.id !== id));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: this.mensajeError(err, 'No se pudo eliminar el recorrido.') };
    }
  }

  async toggleImportante(id: number): Promise<ServiceResult> {
    const objetivo = this.recorridos().find((r) => r.id === id);
    if (!objetivo) {
      return { ok: false, error: 'Recorrido no encontrado.' };
    }
    if (!objetivo.importante && this.recorridos().filter((r) => r.importante).length >= MAX_ESTRELLAS) {
      return { ok: false, error: `Solo puedes tener ${MAX_ESTRELLAS} recorridos estrella. Quita la estrella a otro para marcar este.` };
    }
    try {
      const actualizado = await firstValueFrom(
        this.http.patch<SavedRouteApi>(`${this.baseUrl}/${id}`, { isStarred: !objetivo.importante })
      );
      this.reemplazar(this.fromApi(actualizado));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: this.mensajeError(err, 'No se pudo actualizar el recorrido.') };
    }
  }

  private async refrescar(): Promise<void> {
    const lista = await firstValueFrom(this.http.get<SavedRouteApi[]>(`${this.baseUrl}/me`));
    this.recorridos.set(lista.map((r) => this.fromApi(r)));
  }

  private reemplazar(recorrido: Recorrido): void {
    this.recorridos.update((prev) => prev.map((r) => (r.id === recorrido.id ? recorrido : r)));
  }

  /** Sube al backend los recorridos guardados por la versión anterior y limpia localStorage. */
  private async migrarLocales(): Promise<void> {
    let locales: Array<Partial<Recorrido>> = [];
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
            name: r.nombrePersonalizado || `Ruta ${r.barrioInicio ?? 'A'} → ${r.barrioFin ?? 'B'}`,
            startLabel: r.barrioInicio,
            endLabel: r.barrioFin,
            city: r.municipio,
            department: r.departamento,
            country: r.pais,
            distanceKm: parseFloat(String(r.distanciaEstimada ?? '')) || null,
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

  private toApi(nuevo: NuevoRecorrido): Partial<SavedRouteApi> {
    return {
      name: nuevo.nombre,
      startLabel: nuevo.inicio,
      endLabel: nuevo.fin,
      city: nuevo.municipio,
      department: nuevo.departamento,
      country: nuevo.pais,
      distanceKm: Math.round(nuevo.distanciaKm * 100) / 100,
      estimatedMinutes: nuevo.minutosEstimados,
      points: nuevo.puntos,
      isManual: true,
    };
  }

  private fromApi(api: SavedRouteApi): Recorrido {
    return {
      id: api.id,
      fecha: api.createdAt,
      tiempoEstimado: formatearMinutos(api.estimatedMinutes),
      distanciaEstimada: api.distanceKm != null ? `${Number(api.distanceKm).toFixed(2)} km` : '—',
      barrioInicio: api.startLabel ?? 'Inicio',
      barrioFin: api.endLabel ?? 'Fin',
      municipio: api.city ?? '',
      departamento: api.department ?? '',
      pais: api.country ?? '',
      puntos: api.points ?? [],
      cantidadPuntos: api.points?.length ?? 0,
      esManual: api.isManual,
      nombrePersonalizado: api.name,
      importante: api.isStarred,
    };
  }

  private mensajeError(err: unknown, porDefecto: string): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) return 'No hay conexión con el servidor.';
      if ((err.status === 409 || err.status === 400) && err.error?.message) return err.error.message;
    }
    return porDefecto;
  }
}

function formatearMinutos(minutos?: number): string {
  if (minutos == null) return '—';
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)}h ${minutos % 60}min`;
}
