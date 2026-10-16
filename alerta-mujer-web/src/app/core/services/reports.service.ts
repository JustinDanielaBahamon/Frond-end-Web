import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject, map, tap } from 'rxjs';
import { Reporte, ReporteFilters, ReporteStats } from '../models/report.model';
import { environment } from '../../../environments/environment';

/** Informe tal como lo devuelve /api/admin/reports. */
interface ReporteApi {
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

const ESTADO_API: Record<Reporte['estado'], ReporteApi['status']> = {
  Pendiente: 'pending',
  Atendida: 'attended',
  Cerrada: 'closed'
};
const ESTADO_WEB: Record<ReporteApi['status'], Reporte['estado']> = {
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
  private reportesSubject = new BehaviorSubject<Reporte[]>([]);
  reportes$ = this.reportesSubject.asObservable();

  getAll(): Observable<Reporte[]> {
    return this.http.get<ReporteApi[]>(this.apiUrl).pipe(
      map(lista => lista.map(r => this.desdeApi(r))),
      tap(reportes => this.reportesSubject.next(reportes))
    );
  }

  getById(id: number): Observable<Reporte> {
    return this.http.get<ReporteApi>(`${this.apiUrl}/${id}`).pipe(map(r => this.desdeApi(r)));
  }

  create(reporte: Omit<Reporte, 'id'>): Observable<Reporte> {
    return this.http.post<ReporteApi>(this.apiUrl, this.haciaApi(reporte)).pipe(map(r => this.desdeApi(r)));
  }

  update(id: number, reporte: Reporte): Observable<Reporte> {
    return this.http.put<ReporteApi>(`${this.apiUrl}/${id}`, this.haciaApi(reporte)).pipe(map(r => this.desdeApi(r)));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getStats(): Observable<ReporteStats> {
    return this.http.get<StatsApi>(`${this.apiUrl}/stats`).pipe(
      map(s => ({
        totalReportes: s.totalReports,
        totalAlertas: s.totalAlerts,
        zonasActivas: s.activeZones,
        exportaciones: s.exports
      }))
    );
  }

  // ========================================
  // MÉTODOS DE FILTRADO
  // ========================================

  filtrarReportes(filtros: ReporteFilters): Observable<Reporte[]> {
    let reportesFiltrados = [...this.reportesSubject.value];

    if (filtros.busqueda) {
      const busqueda = this.normalizar(filtros.busqueda);
      reportesFiltrados = reportesFiltrados.filter(reporte =>
        this.normalizar(reporte.nombre).includes(busqueda) ||
        this.normalizar(reporte.ciudad).includes(busqueda) ||
        this.normalizar(reporte.generadoPor).includes(busqueda)
      );
    }

    // Los <input type="date"> entregan 'yyyy-MM-dd'; se compara por día local
    if (filtros.fechaInicio) {
      const desde = this.inicioDelDia(filtros.fechaInicio);
      reportesFiltrados = reportesFiltrados.filter(reporte => reporte.fecha >= desde);
    }
    if (filtros.fechaFin) {
      const hasta = this.inicioDelDia(filtros.fechaFin);
      hasta.setDate(hasta.getDate() + 1);
      reportesFiltrados = reportesFiltrados.filter(reporte => reporte.fecha < hasta);
    }

    if (filtros.ciudad && filtros.ciudad !== 'all') {
      const ciudad = this.normalizar(filtros.ciudad);
      reportesFiltrados = reportesFiltrados.filter(reporte => this.normalizar(reporte.ciudad) === ciudad);
    }

    if (filtros.estado && filtros.estado !== 'all') {
      reportesFiltrados = reportesFiltrados.filter(reporte => reporte.estado === filtros.estado);
    }

    return of(reportesFiltrados);
  }

  // ========================================
  // MÉTODOS DE EXPORTACIÓN
  // ========================================

  descargarPDF(id: number): Observable<Blob> {
    return this.exportar(id, 'pdf');
  }

  /** Excel recibe un CSV (separado por ';' y en UTF-8) que abre directamente. */
  descargarExcel(id: number): Observable<Blob> {
    return this.exportar(id, 'csv');
  }

  descargarCSV(id: number): Observable<Blob> {
    return this.exportar(id, 'csv');
  }

  private exportar(id: number, formato: 'pdf' | 'csv'): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/export`, { params: { format: formato }, responseType: 'blob' });
  }

  // ========================================
  // TRADUCCIÓN API <-> WEB
  // ========================================

  private desdeApi(r: ReporteApi): Reporte {
    return {
      id: r.id,
      nombre: r.name,
      fecha: new Date(r.createdAt),
      ciudad: r.city ?? 'No especificada',
      estado: ESTADO_WEB[r.status] ?? 'Pendiente',
      usuaria: r.userLabel ?? undefined,
      acontecimiento: r.event ?? undefined,
      generadoPor: r.createdByName || 'Administración',
      formato: r.format === 'EXCEL' ? 'Excel' : 'PDF',
      tamano: `${r.alertCount} alerta${r.alertCount === 1 ? '' : 's'}`,
      descripcion: r.description ?? undefined,
      alertasIds: r.alertIds,
      desde: r.fromDate ? new Date(r.fromDate) : null,
      hasta: r.toDate ? new Date(r.toDate) : null,
      exportaciones: r.exportCount ?? 0
    };
  }

  private haciaApi(r: Omit<Reporte, 'id'>) {
    return {
      name: r.nombre,
      city: r.ciudad,
      status: ESTADO_API[r.estado],
      userLabel: r.usuaria ?? null,
      event: r.acontecimiento ?? null,
      description: r.descripcion ?? null,
      format: r.formato === 'PDF' ? 'PDF' : 'EXCEL',
      alertIds: r.alertasIds ?? null,
      fromDate: r.desde ? new Date(r.desde).toISOString() : null,
      toDate: r.hasta ? new Date(r.hasta).toISOString() : null
    };
  }


  private inicioDelDia(valor: Date | string): Date {
    if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      const [a, m, d] = valor.split('-').map(Number);
      return new Date(a, m - 1, d);
    }
    const f = new Date(valor);
    return new Date(f.getFullYear(), f.getMonth(), f.getDate());
  }

  private normalizar(texto: string | undefined | null): string {
    return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }
}
