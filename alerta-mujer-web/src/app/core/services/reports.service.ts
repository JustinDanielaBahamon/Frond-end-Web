import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject, delay, tap } from 'rxjs';
import { Reporte, ReporteFilters, ReporteStats, Paginacion } from '../models/report.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  private apiUrl = `${environment.apiUrl}/reportes`;
  
  // Datos mock locales (para funcionalidad sin backend)
  private reportesMock: Reporte[] = [
    {
      id: 1,
      nombre: 'Reporte de Alertas - Julio 2024',
      fecha: new Date('2024-07-23T10:30:00'),
      ciudad: 'Neiva',
      estado: 'Pendiente',
      usuaria: 'María Pérez',
      acontecimiento: 'SOS en sector centro',
      generadoPor: 'Administrador',
      formato: 'PDF',
      tamano: '2.3 MB',
      descripcion: 'Reporte consolidado de alertas del mes de julio'
    },
    {
      id: 2,
      nombre: 'Reporte de Alertas - Julio 2024',
      fecha: new Date('2024-07-21T16:15:00'),
      ciudad: 'Bogotá',
      estado: 'Cerrada',
      usuaria: 'Ana García',
      acontecimiento: 'Robo en zona norte',
      generadoPor: 'Administrador',
      formato: 'Excel',
      tamano: '1.8 MB',
      descripcion: 'Análisis de incidentes en Bogotá'
    },
    {
      id: 3,
      nombre: 'Reporte de Alertas - Julio 2024',
      fecha: new Date('2024-07-20T11:45:00'),
      ciudad: 'Cali',
      estado: 'Atendida',
      usuaria: 'Laura Martínez',
      acontecimiento: 'Acoso en parque central',
      generadoPor: 'Administrador',
      formato: 'PDF',
      tamano: '1.5 MB',
      descripcion: 'Reporte de casos en la ciudad de Cali'
    },
    {
      id: 4,
      nombre: 'Reporte de Alertas - Julio 2024',
      fecha: new Date('2024-07-19T09:20:00'),
      ciudad: 'Neiva',
      estado: 'Pendiente',
      usuaria: 'Carolina López',
      acontecimiento: 'Emergencia médica',
      generadoPor: 'Administrador',
      formato: 'CSV',
      tamano: '950 KB',
      descripcion: 'Registro de emergencias atendidas'
    },
    {
      id: 5,
      nombre: 'Reporte de Alertas - Julio 2024',
      fecha: new Date('2024-07-18T20:10:00'),
      ciudad: 'Medellín',
      estado: 'Atendida',
      usuaria: 'Daniela Torres',
      acontecimiento: 'SOS en apartamento',
      generadoPor: 'Administrador',
      formato: 'PDF',
      tamano: '2.1 MB',
      descripcion: 'Alertas generadas en Medellín'
    },
    {
      id: 6,
      nombre: 'Reporte de Zonas - Agosto 2024',
      fecha: new Date('2024-08-15T14:30:00'),
      ciudad: 'Barranquilla',
      estado: 'Cerrada',
      usuaria: 'Sofía Ramírez',
      acontecimiento: 'Múltiples alertas en zona',
      generadoPor: 'Administrador',
      formato: 'Excel',
      tamano: '1.2 MB',
      descripcion: 'Análisis de zonas de riesgo en Barranquilla'
    },
    {
      id: 7,
      nombre: 'Reporte Mensual - Agosto 2024',
      fecha: new Date('2024-08-10T08:00:00'),
      ciudad: 'Neiva',
      estado: 'Atendida',
      usuaria: 'Valentina Castro',
      acontecimiento: 'Consolidado mensual',
      generadoPor: 'Administrador',
      formato: 'PDF',
      tamano: '3.5 MB',
      descripcion: 'Reporte mensual consolidado de todas las alertas'
    },
    {
      id: 8,
      nombre: 'Reporte de Alertas - Agosto 2024',
      fecha: new Date('2024-08-05T17:45:00'),
      ciudad: 'Bogotá',
      estado: 'Pendiente',
      usuaria: 'Isabella Rodríguez',
      acontecimiento: 'Casos reportados en sector',
      generadoPor: 'Administrador',
      formato: 'CSV',
      tamano: '800 KB',
      descripcion: 'Casos reportados en Bogotá'
    }
  ];

  private reportesSubject = new BehaviorSubject<Reporte[]>(this.reportesMock);
  reportes$ = this.reportesSubject.asObservable();

  private statsMock: ReporteStats = {
    totalReportes: 542,
    totalAlertas: 1284,
    zonasActivas: 48,
    exportaciones: 91
  };

  // ========================================
  // MÉTODOS API (Futuros - preparados)
  // ========================================

  /**
   * Obtener todos los reportes (API futura)
   */
  getAll(): Observable<Reporte[]> {
    // En el futuro: return this.http.get<Reporte[]>(this.apiUrl);
    return this.reportes$;
  }

  /**
   * Obtener reporte por ID (API futura)
   */
  getById(id: number): Observable<Reporte> {
    // En el futuro: return this.http.get<Reporte>(`${this.apiUrl}/${id}`);
    const reporte = this.reportesMock.find(r => r.id === id);
    return of(reporte as Reporte).pipe(delay(300));
  }

  /**
   * Crear nuevo reporte (API futura)
   */
  create(reporte: Omit<Reporte, 'id'>): Observable<Reporte> {
    // En el futuro: return this.http.post<Reporte>(this.apiUrl, reporte);
    console.log('ReportsService.create llamado con:', reporte);
    
    const nuevoReporte: Reporte = {
      ...reporte,
      id: Date.now(),
      // Datos simulados para la demostración
      alertaData: {
        id: Math.floor(Math.random() * 1000),
        tipo: 'main',
        metodoActivacion: 'boton_fisico',
        estadoFinal: 'resolved',
        horaInicio: new Date(),
        horaFin: new Date(Date.now() + 300000), // 5 minutos después
        duracionTotal: 300
      },
      activador: {
        usuaria: {
          id: 1,
          nombre: reporte.usuaria || 'Usuaria Anónima',
          nombrePrivado: reporte.usuaria || 'Usuaria Anónima'
        },
        dispositivo: {
          marca: 'Samsung',
          modelo: 'Galaxy S21',
          versionAndroid: '12',
          deviceId: 'device-' + Math.random().toString(36).substr(2, 9)
        }
      },
      eventos: {
        ubicacion: {
          coordenadas: [
            { latitud: 2.9273, longitud: -75.2812, hora: new Date() },
            { latitud: 2.9280, longitud: -75.2820, hora: new Date(Date.now() + 60000) }
          ],
          puntoInicio: { latitud: 2.9273, longitud: -75.2812, hora: new Date() },
          ultimoPunto: { latitud: 2.9280, longitud: -75.2820, hora: new Date(Date.now() + 60000) }
        },
        contactosNotificados: [
          {
            id: 1,
            nombre: 'Contacto de Emergencia 1',
            relacion: 'Familia',
            canal: 'SMS',
            estadoEntrega: 'delivered',
            horaNotificacion: new Date()
          }
        ],
        recordatorios: [],
        evidencia: [],
        llamadasRecursos: []
      },
      metadatos: {
        generadoPor: {
          id: 1,
          nombre: 'Administrador',
          rol: 'admin'
        },
        fechaGeneracion: new Date(),
        versionReporte: '1.0'
      }
    };
    
    // Si el reporte tiene alertasIds, agregar esa información
    if (reporte.alertasIds && reporte.alertasIds.length > 0) {
      nuevoReporte.alertasIds = reporte.alertasIds;
      console.log('Reporte creado con alertas:', reporte.alertasIds);
    }
    
    this.reportesMock = [...this.reportesMock, nuevoReporte];
    this.reportesSubject.next(this.reportesMock);
    console.log('Reporte creado exitosamente en servicio:', nuevoReporte);
    return of(nuevoReporte).pipe(delay(500));
  }

  /**
   * Actualizar reporte (API futura)
   */
  update(id: number, reporte: Reporte): Observable<Reporte> {
    // En el futuro: return this.http.put<Reporte>(`${this.apiUrl}/${id}`, reporte);
    console.log('ReportsService.update llamado con id:', id, 'reporte:', reporte);
    const index = this.reportesMock.findIndex(r => r.id === id);
    console.log('Índice encontrado:', index);
    if (index !== -1) {
      this.reportesMock[index] = reporte;
      this.reportesSubject.next(this.reportesMock);
      console.log('Reporte actualizado en índice:', index);
    } else {
      console.error('No se encontró reporte con id:', id);
    }
    return of(reporte).pipe(delay(500));
  }

  /**
   * Eliminar reporte (API futura)
   */
  delete(id: number): Observable<void> {
    // En el futuro: return this.http.delete<void>(`${this.apiUrl}/${id}`);
    this.reportesMock = this.reportesMock.filter(r => r.id !== id);
    this.reportesSubject.next(this.reportesMock);
    return of(void 0).pipe(delay(300));
  }

  /**
   * Obtener estadísticas (API futura)
   */
  getStats(): Observable<ReporteStats> {
    // En el futuro: return this.http.get<ReporteStats>(`${this.apiUrl}/stats`);
    return of(this.statsMock).pipe(delay(200));
  }

  // ========================================
  // MÉTODOS DE FILTRADO (Locales)
  // ========================================

  /**
   * Filtrar reportes según criterios
   */
  filtrarReportes(filtros: ReporteFilters): Observable<Reporte[]> {
    let reportesFiltrados = [...this.reportesMock];

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
  // MÉTODOS DE EXPORTACIÓN (Simulados)
  // ========================================

  /**
   * Descargar reporte en PDF (API futura)
   */
  descargarPDF(id: number): Observable<Blob> {
    // En el futuro: return this.http.get(`${this.apiUrl}/${id}/pdf`, { responseType: 'blob' });
    console.log(`Descargando PDF del reporte ${id}`);
    return of(new Blob()).pipe(delay(1000));
  }

  /**
   * Descargar reporte en Excel (API futura)
   */
  descargarExcel(id: number): Observable<Blob> {
    // En el futuro: return this.http.get(`${this.apiUrl}/${id}/excel`, { responseType: 'blob' });
    console.log(`Descargando Excel del reporte ${id}`);
    return of(new Blob()).pipe(delay(1000));
  }

  /**
   * Descargar reporte en CSV (API futura)
   */
  descargarCSV(id: number): Observable<Blob> {
    // En el futuro: return this.http.get(`${this.apiUrl}/${id}/csv`, { responseType: 'blob' });
    console.log(`Descargando CSV del reporte ${id}`);
    return of(new Blob()).pipe(delay(1000));
  }

  /**
   * Generar reporte nuevo (API futura)
   */
  generarReporte(tipo: string, filtros: ReporteFilters): Observable<Reporte> {
    // En el futuro: return this.http.post<Reporte>(`${this.apiUrl}/generar`, { tipo, filtros });
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
    const reporte = this.reportesMock.find(r => r.id === id);
    if (reporte) {
      console.log('Imprimiendo reporte:', reporte.nombre);
      // Aquí se implementaría la lógica de impresión
      window.print();
    }
  }
}