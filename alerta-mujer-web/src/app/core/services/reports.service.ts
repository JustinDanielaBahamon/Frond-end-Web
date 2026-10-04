import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject, delay } from 'rxjs';
import { Reporte, ReporteFilters, ReporteStats } from '../models/report.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/zone-reports`;
  
  // Sin datos mock - se cargarán desde el backend
  private reportesSubject = new BehaviorSubject<Reporte[]>([]);
  reportes$ = this.reportesSubject.asObservable();

  private statsSubject = new BehaviorSubject<ReporteStats>({
    totalReportes: 0,
    totalAlertas: 0,
    zonasActivas: 0,
    exportaciones: 0
  });
  stats$ = this.statsSubject.asObservable();

  // ========================================
  // MÉTODOS API (Conectar al backend)
  // ========================================

  /**
   * Obtener todos los reportes
   */
  getAll(): Observable<Reporte[]> {
    return this.http.get<Reporte[]>(this.apiUrl);
  }

  /**
   * Obtener reporte por ID
   */
  getById(id: number): Observable<Reporte> {
    return this.http.get<Reporte>(`${this.apiUrl}/${id}`);
  }

  /**
   * Crear nuevo reporte
   */
  create(reporte: Omit<Reporte, 'id'>): Observable<Reporte> {
    return this.http.post<Reporte>(this.apiUrl, reporte);
  }

  /**
   * Actualizar reporte
   */
  update(id: number, reporte: Reporte): Observable<Reporte> {
    return this.http.put<Reporte>(`${this.apiUrl}/${id}`, reporte);
  }

  /**
   * Eliminar reporte
   */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /**
   * Obtener estadísticas
   */
  getStats(): Observable<ReporteStats> {
    // TODO: Conectar al backend
    // return this.http.get<ReporteStats>(`${this.apiUrl}/stats`);
    return this.statsSubject;
  }

  // ========================================
  // MÉTODOS DE FILTRADO
  // ========================================

  /**
   * Filtrar reportes según criterios
   */
  filtrarReportes(filtros: ReporteFilters): Observable<Reporte[]> {
    let reportesFiltrados = [...this.reportesSubject.value];

    // Filtro de búsqueda
    if (filtros.busqueda) {
      const busquedaLower = filtros.busqueda.toLowerCase();
      reportesFiltrados = reportesFiltrados.filter(reporte =>
        reporte.nombre.toLowerCase().includes(busquedaLower) ||
        reporte.ciudad.toLowerCase().includes(busquedaLower) ||
        reporte.generadoPor.toLowerCase().includes(busquedaLower)
      );
    }

    // Filtro por rango de fechas
    if (filtros.fechaInicio) {
      reportesFiltrados = reportesFiltrados.filter(reporte =>
        reporte.fecha >= filtros.fechaInicio!
      );
    }

    if (filtros.fechaFin) {
      reportesFiltrados = reportesFiltrados.filter(reporte =>
        reporte.fecha <= filtros.fechaFin!
      );
    }

    // Filtro por ciudad
    if (filtros.ciudad && filtros.ciudad !== 'all' && filtros.ciudad !== '') {
      reportesFiltrados = reportesFiltrados.filter(reporte =>
        reporte.ciudad.toLowerCase() === filtros.ciudad.toLowerCase()
      );
    }

    // Filtro por estado
    if (filtros.estado && filtros.estado !== 'all' && filtros.estado !== '') {
      reportesFiltrados = reportesFiltrados.filter(reporte =>
        reporte.estado === filtros.estado
      );
    }

    return of(reportesFiltrados).pipe(delay(200));
  }

  // ========================================
  // MÉTODOS DE EXPORTACIÓN
  // ========================================

  /**
   * Descargar reporte en PDF
   */
  descargarPDF(id: number): Observable<Blob> {
    // TODO: Conectar al backend
    // return this.http.get(`${this.apiUrl}/${id}/pdf`, { responseType: 'blob' });
    console.log(`Descargando PDF del reporte ${id}`);
    return of(new Blob()).pipe(delay(1000));
  }

  /**
   * Descargar reporte en Excel
   */
  descargarExcel(id: number): Observable<Blob> {
    // TODO: Conectar al backend
    // return this.http.get(`${this.apiUrl}/${id}/excel`, { responseType: 'blob' });
    console.log(`Descargando Excel del reporte ${id}`);
    return of(new Blob()).pipe(delay(1000));
  }

  /**
   * Descargar reporte en CSV
   */
  descargarCSV(id: number): Observable<Blob> {
    // TODO: Conectar al backend
    // return this.http.get(`${this.apiUrl}/${id}/csv`, { responseType: 'blob' });
    console.log(`Descargando CSV del reporte ${id}`);
    return of(new Blob()).pipe(delay(1000));
  }

  /**
   * Generar reporte nuevo
   */
  generarReporte(tipo: string, filtros: ReporteFilters): Observable<Reporte> {
    // TODO: Conectar al backend
    // return this.http.post<Reporte>(`${this.apiUrl}/generar`, { tipo, filtros });
    const nuevoReporte: Omit<Reporte, 'id'> = {
      nombre: `Reporte de ${tipo} - ${new Date().toLocaleDateString('es-ES')}`,
      fecha: new Date(),
      ciudad: filtros.ciudad || 'Todas',
      estado: 'Pendiente',
      generadoPor: 'Administrador',
      formato: 'PDF',
      tamano: 'Calculando...',
      descripcion: `Reporte generado automáticamente con filtros aplicados`
    };
    
    return this.create(nuevoReporte);
  }

  /**
   * Imprimir reporte (funcionalidad local)
   */
  imprimirReporte(id: number): void {
    const reporte = this.reportesSubject.value.find(r => r.id === id);
    if (reporte) {
      console.log('Imprimiendo reporte:', reporte.nombre);
      window.print();
    }
  }
}
