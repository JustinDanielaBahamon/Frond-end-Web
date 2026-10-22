import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject, map, tap } from 'rxjs';
import { AlertReport, ReportFilters, ReportStats } from '../models/report.model';
import { environment } from '../../../environments/environment';

/** Informe tal como lo devuelve /api/admin/reports. */
interface ReportApi {
  id: number;
  name: string;
  city: string | null;
  status: 'pending' | 'attended' | 'closed';
  userLabel: string | null;
  event: string | null;
  description: string | null;
  format: 'PDF' | 'EXCEL';
  alertIds: number[];
  fromDate: string | null;
  toDate: string | null;
  alertStatus: string | null;
  alertCount: number;
  exportCount: number | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface StatsApi {
  totalReports: number;
  totalAlerts: number;
  activeZones: number;
  exports: number;
}

const API_STATUS: Record<AlertReport['status'], ReportApi['status']> = {
  Pendiente: 'pending',
  Atendida: 'attended',
  Cerrada: 'closed'
};
const WEB_STATUS: Record<ReportApi['status'], AlertReport['status']> = {
  pending: 'Pendiente',
  attended: 'Atendida',
  closed: 'Cerrada'
};

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/admin/reports`;

  // Última lista recibida del backend; los filtros se aplican sobre ella
  private reportsSubject = new BehaviorSubject<AlertReport[]>([]);
  reports$ = this.reportsSubject.asObservable();

  getAll(): Observable<AlertReport[]> {
    return this.http.get<ReportApi[]>(this.apiUrl).pipe(
      map(list => list.map(r => this.fromApi(r))),
      tap(reports => this.reportsSubject.next(reports))
    );
  }

  getById(id: number): Observable<AlertReport> {
    return this.http.get<ReportApi>(`${this.apiUrl}/${id}`).pipe(map(r => this.fromApi(r)));
  }

  create(report: Omit<AlertReport, 'id'>): Observable<AlertReport> {
    return this.http.post<ReportApi>(this.apiUrl, this.toApi(report)).pipe(map(r => this.fromApi(r)));
  }

  update(id: number, report: AlertReport): Observable<AlertReport> {
    return this.http.put<ReportApi>(`${this.apiUrl}/${id}`, this.toApi(report)).pipe(map(r => this.fromApi(r)));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getStats(): Observable<ReportStats> {
    return this.http.get<StatsApi>(`${this.apiUrl}/stats`).pipe(
      map(s => ({
        totalReportCount: s.totalReports,
        totalAlertCount: s.totalAlerts,
        activeZones: s.activeZones,
        exports: s.exports
      }))
    );
  }

  // ========================================
  // MÉTODOS DE FILTRADO
  // ========================================

  filterReports(filters: ReportFilters): Observable<AlertReport[]> {
    let filteredReports = [...this.reportsSubject.value];

    if (filters.search) {
      const search = this.normalize(filters.search);
      filteredReports = filteredReports.filter(report =>
        this.normalize(report.name).includes(search) ||
        this.normalize(report.city).includes(search) ||
        this.normalize(report.generatedBy).includes(search)
      );
    }

    // Los <input type="date"> entregan 'yyyy-MM-dd'; se compara por día local
    if (filters.startDate) {
      const from = this.startOfDay(filters.startDate);
      filteredReports = filteredReports.filter(report => report.date >= from);
    }
    if (filters.endDate) {
      const to = this.startOfDay(filters.endDate);
      to.setDate(to.getDate() + 1);
      filteredReports = filteredReports.filter(report => report.date < to);
    }

    if (filters.city && filters.city !== 'all') {
      const city = this.normalize(filters.city);
      filteredReports = filteredReports.filter(report => this.normalize(report.city) === city);
    }

    if (filters.status && filters.status !== 'all') {
      filteredReports = filteredReports.filter(report => report.status === filters.status);
    }

    return of(filteredReports);
  }

  // ========================================
  // MÉTODOS DE EXPORTACIÓN
  // ========================================

  downloadPdf(id: number): Observable<Blob> {
    return this.export(id, 'pdf');
  }

  /** Excel recibe un CSV (separado por ';' y en UTF-8) que abre directamente. */
  downloadExcel(id: number): Observable<Blob> {
    return this.export(id, 'csv');
  }

  downloadCsv(id: number): Observable<Blob> {
    return this.export(id, 'csv');
  }

  private export(id: number, format: 'pdf' | 'csv'): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/export`, { params: { format }, responseType: 'blob' });
  }

  // ========================================
  // TRADUCCIÓN API <-> WEB
  // ========================================

  private fromApi(r: ReportApi): AlertReport {
    return {
      id: r.id,
      name: r.name,
      date: new Date(r.createdAt),
      city: r.city ?? 'No especificada',
      status: WEB_STATUS[r.status] ?? 'Pendiente',
      user: r.userLabel ?? undefined,
      incident: r.event ?? undefined,
      generatedBy: r.createdByName || 'Administración',
      format: r.format === 'EXCEL' ? 'Excel' : 'PDF',
      size: `${r.alertCount} alerta${r.alertCount === 1 ? '' : 's'}`,
      description: r.description ?? undefined,
      alertIdList: r.alertIds,
      from: r.fromDate ? new Date(r.fromDate) : null,
      to: r.toDate ? new Date(r.toDate) : null,
      exports: r.exportCount ?? 0
    };
  }

  private toApi(r: Omit<AlertReport, 'id'>) {
    return {
      name: r.name,
      city: r.city,
      status: API_STATUS[r.status],
      userLabel: r.user ?? null,
      event: r.incident ?? null,
      description: r.description ?? null,
      format: r.format === 'PDF' ? 'PDF' : 'EXCEL',
      alertIds: r.alertIdList ?? null,
      fromDate: r.from ? new Date(r.from).toISOString() : null,
      toDate: r.to ? new Date(r.to).toISOString() : null
    };
  }


  private startOfDay(value: Date | string): Date {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [a, m, d] = value.split('-').map(Number);
      return new Date(a, m - 1, d);
    }
    const f = new Date(value);
    return new Date(f.getFullYear(), f.getMonth(), f.getDate());
  }

  private normalize(text: string | undefined | null): string {
    return (text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }
}
