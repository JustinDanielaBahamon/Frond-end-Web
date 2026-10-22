import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ResourceCategory, RecordedCall, HelpResource } from '../models/assistance.model';
import { EmergencyResourceApi } from '../models/resource.model';

interface ResourceCallApi {
  id: number;
  emergencyResourceId: number;
  telephoneDialed: string;
  status: string;
  startedAt: string;
}

const CATEGORY: Record<string, ResourceCategory> = {
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
const utcDate = (iso: string) => new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);

@Injectable({ providedIn: 'root' })
export class AssistanceService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /** Todos los recursos activos: líneas (con teléfono) y centros (con ubicación). */
  getResources(): Observable<HelpResource[]> {
    return this.http.get<EmergencyResourceApi[]>(`${this.base}/api/resources`).pipe(
      map((list) =>
        list
          .filter((r) => r.isActive !== false)
          .map((r) => ({
            id: r.id,
            name: r.name,
            category: CATEGORY[r.resourceType] ?? 'apoyo',
            description: r.description ?? '',
            telephone: r.telephone ?? null,
            telephone2: r.secondaryTelephone ?? null,
            email: r.email ?? null,
            address: r.address ?? null,
            city: r.city,
            lat: r.latitude ?? null,
            lng: r.longitude ?? null,
          }))
      )
    );
  }

  /** Llamadas que la usuaria hizo desde la app, de la más reciente a la más antigua. */
  getMyCalls(): Observable<RecordedCall[]> {
    return this.http.get<ResourceCallApi[]>(`${this.base}/api/resource-calls/me`).pipe(
      map((list) =>
        list.map((c) => ({
          id: c.id,
          resourceId: c.emergencyResourceId,
          telephone: c.telephoneDialed,
          status: c.status,
          date: utcDate(c.startedAt),
        }))
      )
    );
  }

  /** Registra que la usuaria marcó a un recurso (la dueña la pone el backend). */
  recordCall(resourceId: number, telephone: string): Observable<RecordedCall> {
    return this.http
      .post<ResourceCallApi>(`${this.base}/api/resource-calls`, {
        emergencyResourceId: resourceId,
        telephoneDialed: telephone,
        status: 'initiated',
      })
      .pipe(map((c) => ({ id: c.id, resourceId: c.emergencyResourceId, telephone: c.telephoneDialed, status: c.status, date: utcDate(c.startedAt) })));
  }

  deleteCall(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/resource-calls/${id}`);
  }
}
