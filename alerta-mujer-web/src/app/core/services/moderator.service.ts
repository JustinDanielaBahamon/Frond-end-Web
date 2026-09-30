import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
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
    return this.http.get<Report[]>(this.apiUrl);
  }

  getById(id: string): Observable<Report> {
    return this.http.get<Report>(`${this.apiUrl}/${id}`);
  }

  create(report: Omit<Report, 'id'>): Observable<Report> {
    return this.http.post<Report>(this.apiUrl, report);
  }

  update(id: string, report: Partial<Report>): Observable<Report> {
    return this.http.put<Report>(`${this.apiUrl}/${id}`, report);
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
