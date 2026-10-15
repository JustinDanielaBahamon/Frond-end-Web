import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RegistroAuditoria {
  id: number;
  accion: string;
  tipo: string;
  registroId: number | null;
  descripcion: string;
  responsableId: number | null;
  responsable: string | null;
  responsableCorreo: string | null;
  ip: string | null;
  fecha: Date;
}

export interface PaginaAuditoria {
  registros: RegistroAuditoria[];
  total: number;
  pagina: number;
  tamano: number;
}

export interface ResponsableAuditoria {
  cuentaId: number;
  nombre: string;
  correo: string;
}

/** Filtros del módulo de Auditoría; responsableId 0 = cambios del sistema. Fechas en 'yyyy-MM-dd'. */
export interface FiltrosAuditoria {
  responsableId: number | null;
  tipo: string;
  accion: string;
  desde: string;
  hasta: string;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/admin/audit-log`;

  listar(filtros: FiltrosAuditoria, pagina: number, tamano: number): Observable<PaginaAuditoria> {
    const params = this.params(filtros).set('page', pagina).set('size', tamano);
    return this.http.get<any>(this.url, { params }).pipe(map(p => ({
      registros: p.items.map((r: any) => this.desdeApi(r)),
      total: p.total,
      pagina: p.page,
      tamano: p.size
    })));
  }

  responsables(): Observable<ResponsableAuditoria[]> {
    return this.http.get<any[]>(`${this.url}/actors`).pipe(
      map(lista => lista.map(a => ({ cuentaId: a.accountId, nombre: a.name, correo: a.email })))
    );
  }

  exportar(filtros: FiltrosAuditoria): Observable<Blob> {
    return this.http.get(`${this.url}/export`, { params: this.params(filtros), responseType: 'blob' });
  }

  private params(f: FiltrosAuditoria): HttpParams {
    let p = new HttpParams();
    if (f.responsableId !== null) p = p.set('actorId', f.responsableId);
    if (f.tipo) p = p.set('type', f.tipo);
    if (f.accion) p = p.set('action', f.accion);
    if (f.desde) p = p.set('from', f.desde);
    if (f.hasta) p = p.set('to', f.hasta);
    return p;
  }

  private desdeApi(r: any): RegistroAuditoria {
    return {
      id: r.id,
      accion: r.action,
      tipo: r.entityType,
      registroId: r.entityId,
      descripcion: r.description ?? '',
      responsableId: r.actorAccountId,
      responsable: r.actorName,
      responsableCorreo: r.actorEmail,
      ip: r.ipAddress,
      fecha: new Date(r.createdAt)
    };
  }
}
