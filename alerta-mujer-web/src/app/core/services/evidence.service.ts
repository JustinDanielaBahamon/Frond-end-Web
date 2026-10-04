import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject, delay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Evidencia, EvidenciaFilters, EvidenciaStats } from '../models/evidence.model';

@Injectable({ providedIn: 'root' })
export class EvidenceService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/evidences`;

  // Sin datos mock - se cargarán desde el backend
  private evidenciasSubject = new BehaviorSubject<Evidencia[]>([]);
  evidencias$ = this.evidenciasSubject.asObservable();

  private statsSubject = new BehaviorSubject<EvidenciaStats>({
    totalEvidencias: 0,
    verificadas: 0,
    pendientes: 0,
    rechazadas: 0,
    descargas: 0
  });
  stats$ = this.statsSubject.asObservable();

  // Variable para el contador de descargas
  private contadorDescargas: number = 0;

  // ========================================
  // MÉTODOS API (Conectar al backend)
  // ========================================

  /**
   * Obtener todas las evidencias
   */
  getAll(): Observable<Evidencia[]> {
    return this.http.get<Evidencia[]>(this.url);
  }

  /**
   * Obtener evidencia por ID
   */
  getById(id: number): Observable<Evidencia> {
    // TODO: Conectar al backend
    // return this.http.get<Evidencia>(`${this.url}/${id}`);
    const evidencia = this.evidenciasSubject.value.find(e => e.id === id);
    return of(evidencia as Evidencia).pipe(delay(300));
  }

  /**
   * Usado por USUARIA: solo sus propias evidencias
   */
  getByUsuario(usuarioId: number): Observable<Evidencia[]> {
    return this.http.get<Evidencia[]>(`${this.url}?usuarioId=${usuarioId}`);
  }

  /**
   * Crear nueva evidencia
   */
  create(evidencia: Omit<Evidencia, 'id'>): Observable<Evidencia> {
    return this.http.post<Evidencia>(this.url, evidencia);
  }

  /**
   * Actualizar evidencia
   */
  update(id: number, evidencia: Evidencia): Observable<Evidencia> {
    return this.http.put<Evidencia>(`${this.url}/${id}`, evidencia);
  }

  /**
   * Eliminar evidencia
   */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /**
   * Obtener estadísticas
   */
  getStats(): Observable<EvidenciaStats> {
    // TODO: Conectar al backend
    // return this.http.get<EvidenciaStats>(`${this.url}/stats`);
    const stats = this.calcularEstadisticas();
    return of(stats).pipe(delay(200));
  }

  /**
   * Calcular estadísticas dinámicamente desde las evidencias
   */
  private calcularEstadisticas(): EvidenciaStats {
    const evidencias = this.evidenciasSubject.value;
    const total = evidencias.length;
    const verificadas = evidencias.filter(e => e.estado === 'Verificada').length;
    const pendientes = evidencias.filter(e => e.estado === 'Pendiente').length;
    const rechazadas = evidencias.filter(e => e.estado === 'Rechazada').length;
    
    return {
      totalEvidencias: total,
      verificadas: verificadas,
      pendientes: pendientes,
      rechazadas: rechazadas,
      descargas: this.contadorDescargas
    };
  }

  /**
   * Actualizar estadísticas y notificar a los suscriptores
   */
  private actualizarEstadisticas(): void {
    const stats = this.calcularEstadisticas();
    this.statsSubject.next(stats);
  }

  /**
   * Descargar evidencia
   */
  descargar(id: number): Observable<Blob> {
    // TODO: Conectar al backend
    // return this.http.get(`${this.url}/${id}/descargar`, { responseType: 'blob' });
    console.log(`Descargando evidencia ${id}. Contador antes: ${this.contadorDescargas}`);
    this.contadorDescargas++;
    console.log(`Contador después: ${this.contadorDescargas}`);
    this.actualizarEstadisticas();
    return of(new Blob()).pipe(delay(1000));
  }

  /**
   * Ver evidencia (retorna URL para visualización)
   */
  getVerUrl(id: number): Observable<string> {
    // TODO: Conectar al backend
    // return this.http.get(`${this.url}/${id}/ver`, { responseType: 'text' });
    const evidencia = this.evidenciasSubject.value.find(e => e.id === id);
    return of(evidencia?.archivoUrl || '').pipe(delay(300));
  }

  // ========================================
  // MÉTODOS DE FILTRADO
  // ========================================

  /**
   * Filtrar evidencias según criterios
   */
  filtrarEvidencias(filtros: EvidenciaFilters): Observable<Evidencia[]> {
    let evidenciasFiltradas = [...this.evidenciasSubject.value];

    // Filtro de búsqueda
    if (filtros.busqueda && filtros.busqueda.trim() !== '') {
      const busquedaLower = filtros.busqueda.toLowerCase().trim();
      evidenciasFiltradas = evidenciasFiltradas.filter(evidencia => {
        return (
          evidencia.nombre.toLowerCase().includes(busquedaLower) ||
          evidencia.alertaId.toLowerCase().includes(busquedaLower) ||
          evidencia.usuarioNombre.toLowerCase().includes(busquedaLower) ||
          evidencia.usuarioEmail.toLowerCase().includes(busquedaLower) ||
          evidencia.alertaTipo.toLowerCase().includes(busquedaLower) ||
          evidencia.alertaCiudad.toLowerCase().includes(busquedaLower) ||
          (evidencia.ubicacion && evidencia.ubicacion.toLowerCase().includes(busquedaLower)) ||
          evidencia.tipo.toLowerCase().includes(busquedaLower) ||
          evidencia.estado.toLowerCase().includes(busquedaLower) ||
          evidencia.tamanio.toLowerCase().includes(busquedaLower)
        );
      });
    }

    // Filtro por tipo
    if (filtros.tipo && filtros.tipo !== 'all') {
      evidenciasFiltradas = evidenciasFiltradas.filter(evidencia =>
        evidencia.tipo === filtros.tipo
      );
    }

    // Filtro por estado
    if (filtros.estado && filtros.estado !== 'all') {
      evidenciasFiltradas = evidenciasFiltradas.filter(evidencia =>
        evidencia.estado === filtros.estado
      );
    }

    // Filtro por rango de fechas
    if (filtros.fechaInicio) {
      evidenciasFiltradas = evidenciasFiltradas.filter(evidencia =>
        new Date(evidencia.fecha) >= filtros.fechaInicio!
      );
    }

    if (filtros.fechaFin) {
      evidenciasFiltradas = evidenciasFiltradas.filter(evidencia =>
        new Date(evidencia.fecha) <= filtros.fechaFin!
      );
    }

    return of(evidenciasFiltradas).pipe(delay(200));
  }

  /**
   * Cambiar estado de evidencia
   */
  cambiarEstado(id: number, nuevoEstado: 'Verificada' | 'Pendiente' | 'Rechazada'): Observable<Evidencia> {
    const currentEvidencias = this.evidenciasSubject.value;
    const evidencia = currentEvidencias.find(e => e.id === id);
    if (evidencia) {
      evidencia.estado = nuevoEstado;
      this.evidenciasSubject.next(currentEvidencias);
      this.actualizarEstadisticas();
      return of(evidencia).pipe(delay(300));
    }
    return of({} as Evidencia).pipe(delay(300));
  }
}
