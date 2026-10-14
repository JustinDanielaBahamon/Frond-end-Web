import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CategoriaRecurso, LlamadaRegistrada, RecursoAyuda } from '../models/assistance.model';
import { EmergencyResourceApi } from '../models/resource.model';

interface ResourceCallApi {
  id: number;
  emergencyResourceId: number;
  telephoneDialed: string;
  status: string;
  startedAt: string;
}

const CATEGORIA: Record<string, CategoriaRecurso> = {
  emergency_line: 'linea',
  police_station: 'policia',
  police_post: 'policia',
  hospital: 'salud',
  health_center: 'salud',
  ambulance: 'salud',
  fire_station: 'bomberos',
  support_organization: 'apoyo',
};

// El backend envía LocalDateTime en UTC sin zona
const fechaUtc = (iso: string) => new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);

@Injectable({ providedIn: 'root' })
export class AssistanceService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /** Todos los recursos activos: líneas (con teléfono) y centros (con ubicación). */
  getRecursos(): Observable<RecursoAyuda[]> {
    return this.http.get<EmergencyResourceApi[]>(`${this.base}/api/resources`).pipe(
      map((lista) =>
        lista
          .filter((r) => r.isActive !== false)
          .map((r) => ({
            id: r.id,
            nombre: r.name,
            categoria: CATEGORIA[r.resourceType] ?? 'apoyo',
            descripcion: r.description ?? '',
            telefono: r.telephone ?? null,
            telefono2: r.secondaryTelephone ?? null,
            email: r.email ?? null,
            direccion: r.address ?? null,
            ciudad: r.city,
            lat: r.latitude ?? null,
            lng: r.longitude ?? null,
          }))
      )
    );
  }

  /** Llamadas que la usuaria hizo desde la app, de la más reciente a la más antigua. */
  getMisLlamadas(): Observable<LlamadaRegistrada[]> {
    return this.http.get<ResourceCallApi[]>(`${this.base}/api/resource-calls/me`).pipe(
      map((lista) =>
        lista.map((c) => ({
          id: c.id,
          recursoId: c.emergencyResourceId,
          telefono: c.telephoneDialed,
          estado: c.status,
          fecha: fechaUtc(c.startedAt),
        }))
      )
    );
  }

  /** Registra que la usuaria marcó a un recurso (la dueña la pone el backend). */
  registrarLlamada(recursoId: number, telefono: string): Observable<LlamadaRegistrada> {
    return this.http
      .post<ResourceCallApi>(`${this.base}/api/resource-calls`, {
        emergencyResourceId: recursoId,
        telephoneDialed: telefono,
        status: 'initiated',
      })
      .pipe(map((c) => ({ id: c.id, recursoId: c.emergencyResourceId, telefono: c.telephoneDialed, estado: c.status, fecha: fechaUtc(c.startedAt) })));
  }

  eliminarLlamada(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/resource-calls/${id}`);
  }
}
