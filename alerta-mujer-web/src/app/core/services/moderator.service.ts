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
    pendingReports: 32,
    resolvedCases: 128,
    sanctionedUsers: 15
  });

  // Observables públicos
  reports$ = this.reportsSubject.asObservable();
  stats$ = this.statsSubject.asObservable();

  private destroy$ = new Subject<void>();

  constructor() {
    // Cargar datos mock iniciales
    this.loadMockData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========================================
  // DATOS MOCK (Eliminar cuando se conecte al backend)
  // ========================================

  private loadMockData(): void {
    const mockReports: Report[] = [
      {
        id: '#REP-001',
        userName: 'María García',
        userEmail: 'maria.g@email.com',
        reason: 'Acoso',
        severity: 'Alta',
        date: '23/07/2024 10:30 AM',
        status: 'Pendiente',
        description: 'La usuaria ha enviado múltiples mensajes ofensivos a otros usuarios de la plataforma.'
      },
      {
        id: '#REP-002',
        userName: 'Carlos Rodríguez',
        userEmail: 'carlos.r@email.com',
        reason: 'Spam',
        severity: 'Media',
        date: '22/07/2024 04:15 PM',
        status: 'En revisión',
        description: 'Publicación repetitiva de contenido promocional sin autorización.'
      },
      {
        id: '#REP-003',
        userName: 'Ana Martínez',
        userEmail: 'ana.m@email.com',
        reason: 'Contenido inapropiado',
        severity: 'Baja',
        date: '21/07/2024 11:45 AM',
        status: 'Resuelto',
        description: 'Compartió contenido que no cumple con las políticas de la comunidad.'
      },
      {
        id: '#REP-004',
        userName: 'Pedro Sánchez',
        userEmail: 'pedro.s@email.com',
        reason: 'Discurso de odio',
        severity: 'Crítica',
        date: '20/07/2024 09:20 AM',
        status: 'Pendiente',
        description: 'Comentarios discriminatorios contra grupos específicos en foros públicos.'
      },
      {
        id: '#REP-005',
        userName: 'Laura López',
        userEmail: 'laura.l@email.com',
        reason: 'Falsificación',
        severity: 'Alta',
        date: '19/07/2024 08:10 PM',
        status: 'Rechazado',
        description: 'Intento de suplantar identidad de otro usuario verificado.'
      },
      {
        id: '#REP-006',
        userName: 'Diego Torres',
        userEmail: 'diego.t@email.com',
        reason: 'Acoso',
        severity: 'Media',
        date: '18/07/2024 03:30 PM',
        status: 'En revisión',
        description: 'Persecución constante a una usuaria en múltiples publicaciones.'
      },
      {
        id: '#REP-007',
        userName: 'Sofía Ramírez',
        userEmail: 'sofia.r@email.com',
        reason: 'Spam',
        severity: 'Baja',
        date: '17/07/2024 11:00 AM',
        status: 'Resuelto',
        description: 'Envío masivo de mensajes no solicitados a múltiples usuarios.'
      }
    ];

    this.reportsSubject.next(mockReports);
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
