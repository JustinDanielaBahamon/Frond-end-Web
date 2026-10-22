import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuditRecord {
  id: number;
  action: string;
  tipo: string;
  recordId: number | null;
  description: string;
  actorId: number | null;
  actor: string | null;
  actorEmail: string | null;
  /** 'Administración' | 'Usuaria' | null */
  role: string | null;
  /** Desde dónde se hizo: 'Panel web · Chrome · Linux', 'App móvil · Android', 'Tarea automática · …' */
  source: string | null;
  ip: string | null;
  fecha: Date;
}

export interface AuditPage {
  records: AuditRecord[];
  total: number;
  page: number;
  size: number;
}

export interface AuditActor {
  accountId: number;
  nombre: string;
  email: string;
}

/** Filtros del módulo de Auditoría; responsableId 0 = cambios del sistema. Fechas en 'yyyy-MM-dd'. */
export interface AuditFilters {
  actorId: number | null;
  tipo: string;
  action: string;
  from: string;
  to: string;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/admin/audit-log`;

  list(filters: AuditFilters, page: number, size: number): Observable<AuditPage> {
    const params = this.params(filters).set('page', page).set('size', size);
    return this.http.get<any>(this.url, { params }).pipe(map(p => ({
      records: p.items.map((r: any) => this.fromApi(r)),
      total: p.total,
      page: p.page,
      size: p.size
    })));
  }

  actors(): Observable<AuditActor[]> {
    return this.http.get<any[]>(`${this.url}/actors`).pipe(
      map(list => list.map(a => ({ accountId: a.accountId, nombre: a.name, email: a.email })))
    );
  }

  export(filters: AuditFilters): Observable<Blob> {
    return this.http.get(`${this.url}/export`, { params: this.params(filters), responseType: 'blob' });
  }

  private params(f: AuditFilters): HttpParams {
    let p = new HttpParams();
    if (f.actorId !== null) p = p.set('actorId', f.actorId);
    if (f.tipo) p = p.set('type', f.tipo);
    if (f.action) p = p.set('action', f.action);
    if (f.from) p = p.set('from', f.from);
    if (f.to) p = p.set('to', f.to);
    return p;
  }

  private fromApi(r: any): AuditRecord {
    return {
      id: r.id,
      action: r.action,
      tipo: r.entityType,
      recordId: r.entityId,
      description: r.description ?? '',
      actorId: r.actorAccountId,
      actor: r.actorName,
      actorEmail: r.actorEmail,
      role: r.actorRole ?? null,
      source: r.source ?? null,
      ip: r.ipAddress,
      fecha: new Date(r.createdAt)
    };
  }
}
