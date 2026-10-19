import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Report {
  id: string;
  userName: string;
  userEmail: string;
  reason: string;
  severity: string;
  date: string;
  status: string;
  description: string;
  /** Quién registró el caso (en un bloqueo, la administradora que bloqueó). */
  reporterName?: string;
  resolutionNotes?: string;
  hasEvidence?: boolean;
}

/** Reporte tal como lo devuelve el backend (/api/admin/user-reports). */
interface UserReportApi {
  id: number;
  reportedUserId: number;
  reportedUserName: string | null;
  reportedUserEmail: string | null;
  reporterName: string | null;
  reason: string;
  description: string;
  severity: string;   // low | medium | high | critical
  status: string;     // pending | in_review | reviewed | resolved | approved | rejected
  resolutionNotes: string | null;
  createdAt: string | null;
  hasEvidence?: boolean;
}

const GRAVEDAD_DESDE_API: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' };
const GRAVEDAD_HACIA_API: Record<string, string> = { Baja: 'low', Media: 'medium', Alta: 'high', 'Crítica': 'critical' };
const ESTADO_DESDE_API: Record<string, string> = {
  pending: 'Pendiente', in_review: 'En revisión', reviewed: 'Resuelto', resolved: 'Resuelto',
  approved: 'Resuelto', rejected: 'Rechazado',
};
const ESTADO_HACIA_API: Record<string, string> = {
  Pendiente: 'pending', 'En revisión': 'in_review', Resuelto: 'resolved', Rechazado: 'rejected',
};

function fechaLegible(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function desdeApi(r: UserReportApi): Report {
  return {
    id: String(r.id),
    userName: r.reportedUserName ?? 'Usuaria sin nombre',
    userEmail: r.reportedUserEmail ?? '',
    reason: r.reason,
    severity: GRAVEDAD_DESDE_API[r.severity] ?? 'Media',
    date: fechaLegible(r.createdAt),
    status: ESTADO_DESDE_API[r.status] ?? 'Pendiente',
    description: r.description,
    reporterName: r.reporterName ?? undefined,
    resolutionNotes: r.resolutionNotes ?? undefined,
    hasEvidence: !!r.hasEvidence,
  };
}

/** Solo se envían los campos que el backend acepta; la usuaria reportada se identifica por su correo. */
function haciaApi(r: Partial<Report>) {
  return {
    ...(r.userEmail !== undefined && { reportedUserEmail: r.userEmail }),
    ...(r.reason !== undefined && { reason: r.reason }),
    ...(r.description !== undefined && { description: r.description }),
    ...(r.severity && GRAVEDAD_HACIA_API[r.severity] && { severity: GRAVEDAD_HACIA_API[r.severity] }),
    ...(r.status && ESTADO_HACIA_API[r.status] && { status: ESTADO_HACIA_API[r.status] }),
  };
}

@Injectable({
  providedIn: 'root'
})
export class ModeratorService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/admin/user-reports`;

  // BehaviorSubjects para datos reactivos
  private reportsSubject = new BehaviorSubject<Report[]>([]);
  private statsSubject = new BehaviorSubject({
    pendingReports: 0,
    resolvedCases: 0,
    sanctionedUsers: 0
  });

  // Observables públicos
  reports$ = this.reportsSubject.asObservable();
  stats$ = this.statsSubject.asObservable();

  private destroy$ = new Subject<void>();

  constructor() {
    // Sin datos mock - se cargarán desde el backend
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========================================
  // MÉTODOS CRUD (Conectar al backend)
  // ========================================

  getAll(): Observable<Report[]> {
    return this.http.get<UserReportApi[]>(this.apiUrl).pipe(map(lista => lista.map(desdeApi)));
  }

  getById(id: string): Observable<Report> {
    return this.http.get<UserReportApi>(`${this.apiUrl}/${id}`).pipe(map(desdeApi));
  }

  create(report: Omit<Report, 'id'>): Observable<Report> {
    // El estado lo decide el backend: todo reporte nuevo empieza pendiente
    const { status, ...datos } = report;
    return this.http.post<UserReportApi>(this.apiUrl, haciaApi(datos)).pipe(map(desdeApi));
  }

  update(id: string, report: Partial<Report>): Observable<Report> {
    // La usuaria reportada no cambia al editar
    const { userEmail, userName, ...cambios } = report;
    return this.http.put<UserReportApi>(`${this.apiUrl}/${id}`, haciaApi(cambios)).pipe(map(desdeApi));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // ========================================
  // MÉTODOS DE FILTRADO
  // ========================================

  filtrarReportes(filtros: {
    searchTerm?: string;
    reason?: string;
    severity?: string;
    status?: string;
    date?: string;
  }): Observable<Report[]> {
    // TODO: Conectar al backend con parámetros de query
    // const params = new HttpParams().setAll(filtros);
    // return this.http.get<Report[]>(this.apiUrl, { params });
    
    return this.reports$;
  }

  // ========================================
  // ESTADÍSTICAS
  // ========================================

  getStats(): Observable<any> {
    // TODO: Conectar al backend
    // return this.http.get(`${this.apiUrl}/stats`);
    return this.stats$;
  }

  actualizarStats(): void {
    // TODO: Calcular estadísticas basadas en los reportes actuales
    const reports = this.reportsSubject.value;
    const stats = {
      pendingReports: reports.filter(r => r.status === 'Pendiente').length,
      resolvedCases: reports.filter(r => r.status === 'Resuelto').length,
      sanctionedUsers: 0 // TODO: Calcular basado en usuarios sancionados
    };
    this.statsSubject.next(stats);
  }
}
