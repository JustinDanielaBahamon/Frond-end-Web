import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject, delay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Evidencia, EvidenciaFilters, EvidenciaStats } from '../models/evidence.model';

@Injectable({ providedIn: 'root' })
export class EvidenceService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/evidencias`;

  private evidencias: Evidencia[] = [];

  private evidenciasSubject = new BehaviorSubject<Evidencia[]>(this.evidencias);
  evidencias$ = this.evidenciasSubject.asObservable();

  private stats: EvidenciaStats = {
    totalEvidencias: 0,
    verificadas: 0,
    pendientes: 0,
    rechazadas: 0,
    descargas: 0
  };

  // Variable separada para el contador de descargas que no se sobrescribe
  private contadorDescargas: number = 0;

  private statsSubject = new BehaviorSubject<EvidenciaStats>(this.stats);
  stats$ = this.statsSubject.asObservable();

  // ========================================
  // MÉTODOS API (Futuros - preparados)
  // ========================================

  /**
   * Obtener todas las evidencias (API futura)
   */
  getAll(): Observable<Evidencia[]> {
    // En el futuro: return this.http.get<Evidencia[]>(this.url);
    return this.evidencias$;
  }

  /**
   * Obtener evidencia por ID (API futura)
   */
  getById(id: number): Observable<Evidencia> {
    // En el futuro: return this.http.get<Evidencia>(`${this.url}/${id}`);
    const evidencia = this.evidencias.find(e => e.id === id);
    return of(evidencia as Evidencia).pipe(delay(300));
  }

  /**
   * Usado por USUARIA: solo sus propias evidencias
   */
  getByUsuario(usuarioId: number): Observable<Evidencia[]> {
    // En el futuro: return this.http.get<Evidencia[]>(`${this.url}?usuarioId=${usuarioId}`);
    const evidenciasUsuario = this.evidencias.filter(e => e.usuarioId === usuarioId);
    return of(evidenciasUsuario).pipe(delay(300));
  }

  /**
   * Crear nueva evidencia (API futura)
   */
  create(evidencia: Omit<Evidencia, 'id'>): Observable<Evidencia> {
    // En el futuro: return this.http.post<Evidencia>(this.url, evidencia);
    console.log('EvidenceService.create llamado con:', evidencia);
    
    const nuevaEvidencia: Evidencia = {
      ...evidencia,
      id: Date.now()
    };
    
    this.evidencias = [...this.evidencias, nuevaEvidencia];
    this.evidenciasSubject.next(this.evidencias);
    this.actualizarEstadisticas(); // Actualizar estadísticas
    console.log('Evidencia creada exitosamente en servicio:', nuevaEvidencia);
    return of(nuevaEvidencia).pipe(delay(500));
  }

  /**
   * Actualizar evidencia (API futura)
   */
  update(id: number, evidencia: Evidencia): Observable<Evidencia> {
    // En el futuro: return this.http.put<Evidencia>(`${this.url}/${id}`, evidencia);
    console.log('EvidenceService.update llamado con id:', id, 'evidencia:', evidencia);
    const index = this.evidencias.findIndex(e => e.id === id);
    console.log('Índice encontrado:', index);
    if (index !== -1) {
      this.evidencias[index] = evidencia;
      this.evidenciasSubject.next(this.evidencias);
      this.actualizarEstadisticas(); // Actualizar estadísticas
      console.log('Evidencia actualizada en índice:', index);
    } else {
      console.error('No se encontró evidencia con id:', id);
    }
    return of(evidencia).pipe(delay(500));
  }

  /**
   * Eliminar evidencia (API futura)
   */
  delete(id: number): Observable<void> {
    // En el futuro: return this.http.delete<void>(`${this.url}/${id}`);
    this.evidencias = this.evidencias.filter(e => e.id !== id);
    this.evidenciasSubject.next(this.evidencias);
    this.actualizarEstadisticas(); // Actualizar estadísticas
    return of(void 0).pipe(delay(300));
  }

  /**
   * Obtener estadísticas (API futura)
   */
  getStats(): Observable<EvidenciaStats> {
    // En el futuro: return this.http.get<EvidenciaStats>(`${this.url}/stats`);
    // Calcular estadísticas dinámicamente basándose en las evidencias actuales
    const stats = this.calcularEstadisticas();
    return of(stats).pipe(delay(200));
  }

  /**
   * Calcular estadísticas dinámicamente desde las evidencias
   */
  private calcularEstadisticas(): EvidenciaStats {
    const total = this.evidencias.length;
    const verificadas = this.evidencias.filter(e => e.estado === 'Verificada').length;
    const pendientes = this.evidencias.filter(e => e.estado === 'Pendiente').length;
    const rechazadas = this.evidencias.filter(e => e.estado === 'Rechazada').length;
    
    return {
      totalEvidencias: total,
      verificadas: verificadas,
      pendientes: pendientes,
      rechazadas: rechazadas,
      descargas: this.contadorDescargas // Usar la variable separada
    };
  }

  /**
   * Actualizar estadísticas y notificar a los suscriptores
   */
  private actualizarEstadisticas(): void {
    const stats = this.calcularEstadisticas();
    this.stats = stats;
    console.log('Estadísticas calculadas y actualizadas:', stats);
    this.statsSubject.next(stats);
  }

  /**
   * Descargar evidencia (API futura)
   */
  descargar(id: number): Observable<Blob> {
    // En el futuro: return this.http.get(`${this.url}/${id}/descargar`, { responseType: 'blob' });
    console.log(`Descargando evidencia ${id}. Contador antes: ${this.contadorDescargas}`);
    this.contadorDescargas++; // Incrementar el contador separado de descargas
    console.log(`Contador después: ${this.contadorDescargas}`);
    this.actualizarEstadisticas(); // Notificar a los suscriptores del cambio
    return of(new Blob()).pipe(delay(1000));
  }

  /**
   * Ver evidencia (API futura - retorna URL para visualización)
   */
  getVerUrl(id: number): Observable<string> {
    // En el futuro: return this.http.get(`${this.url}/${id}/ver`, { responseType: 'text' });
    const evidencia = this.evidencias.find(e => e.id === id);
    return of(evidencia?.archivoUrl || '').pipe(delay(300));
  }

  // ========================================
  // MÉTODOS DE FILTRADO (Locales)
  // ========================================

  /**
   * Filtrar evidencias según criterios
   */
  filtrarEvidencias(filtros: EvidenciaFilters): Observable<Evidencia[]> {
    let evidenciasFiltradas = [...this.evidencias];

    // Filtro de búsqueda general mejorado
    if (filtros.busqueda && filtros.busqueda.trim() !== '') {
      const busquedaLower = filtros.busqueda.toLowerCase().trim();
      evidenciasFiltradas = evidenciasFiltradas.filter(evidencia => {
        // Buscar en múltiples campos para mejor coincidencia
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
   * Cambiar estado de evidencia (API futura)
   */
  cambiarEstado(id: number, nuevoEstado: 'Verificada' | 'Pendiente' | 'Rechazada'): Observable<Evidencia> {
    const evidencia = this.evidencias.find(e => e.id === id);
    if (evidencia) {
      evidencia.estado = nuevoEstado;
      this.evidenciasSubject.next(this.evidencias);
      this.actualizarEstadisticas(); // Actualizar estadísticas
      return of(evidencia).pipe(delay(300));
    }
    return of({} as Evidencia).pipe(delay(300));
  }
}