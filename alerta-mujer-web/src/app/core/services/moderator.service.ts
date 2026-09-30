import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

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
  private apiUrl = '/api/reports'; // Placeholder para backend

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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========================================
  // MÉTODOS CRUD (Conectar al backend)
  // ========================================

  getAll(): Observable<Report[]> {
    // TODO: Conectar al backend
    // return this.http.get<Report[]>(this.apiUrl);
    return this.reports$;
  }

  getById(id: string): Report | undefined {
    // TODO: Conectar al backend
    // return this.http.get<Report>(`${this.apiUrl}/${id}`);
    return this.reportsSubject.value.find(r => r.id === id);
  }

  create(report: Omit<Report, 'id'>): Observable<Report> {
    // TODO: Conectar al backend
    // return this.http.post<Report>(this.apiUrl, report);
    const currentReports = this.reportsSubject.value;
    const newReport: Report = {
      ...report,
      id: `#REP-${String(currentReports.length + 1).padStart(3, '0')}`
    };
    this.reportsSubject.next([...currentReports, newReport]);
    return new Observable(observer => {
      observer.next(newReport);
      observer.complete();
    });
  }

  update(id: string, report: Partial<Report>): Observable<Report> {
    // TODO: Conectar al backend
    // return this.http.put<Report>(`${this.apiUrl}/${id}`, report);
    const currentReports = this.reportsSubject.value;
    const updatedReports = currentReports.map(r =>
      r.id === id ? { ...r, ...report } : r
    );
    this.reportsSubject.next(updatedReports);
    return new Observable(observer => {
      const updated = updatedReports.find(r => r.id === id);
      if (updated) {
        observer.next(updated);
        observer.complete();
      }
    });
  }

  delete(id: string): Observable<void> {
    // TODO: Conectar al backend
    // return this.http.delete<void>(`${this.apiUrl}/${id}`);
    const currentReports = this.reportsSubject.value;
    const filteredReports = currentReports.filter(r => r.id !== id);
    this.reportsSubject.next(filteredReports);
    return new Observable(observer => {
      observer.next();
      observer.complete();
    });
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
    
    return this.reports$.pipe(
      // map(reports => {
      //   return reports.filter(report => {
      //     // Lógica de filtrado
      //     return true;
      //   });
      // })
    );
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
      sanctionedUsers: 15 // TODO: Calcular basado en usuarios sancionados
    };
    this.statsSubject.next(stats);
  }
}
