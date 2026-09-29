import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, takeUntil } from 'rxjs';
import { Evidencia, EvidenciaFilters, EvidenciaStats } from '../../../core/models/evidence.model';
import { EvidenceService } from '../../../core/services/evidence.service';

@Component({
  selector: 'app-evidences-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './evidence-management.html',
  styleUrls: ['./evidence-management.scss']
})
export class EvidencesManagementComponent implements OnInit {
  private destroy$ = new Subject<void>();
  private evidenceService = inject(EvidenceService);

  // Datos
  evidencias$: Observable<Evidencia[]> = this.evidenceService.evidencias$;
  stats$: Observable<EvidenciaStats> = this.evidenceService.getStats();
  
  evidenciasFiltradas: Evidencia[] = [];
  filteredEvidences: Evidencia[] = []; // Para compatibilidad con HTML
  stats: EvidenciaStats = {
    totalEvidencias: 0,
    verificadas: 0,
    pendientes: 0,
    rechazadas: 0,
    descargas: 0
  };

  // Filtros
  filtros: EvidenciaFilters = {
    busqueda: '',
    tipo: '',
    estado: '',
    fechaInicio: null,
    fechaFin: null
  };

  // Paginación
  currentPage: number = 1;
  itemsPerPage: number = 6;
  totalPages: number = 0;

  // Estados UI
  cargando = false;
  error = '';
  evidenciaSeleccionada: Evidencia | null = null;
  mostrarModalVer = false;
  
  // Estados de dropdowns personalizados
  isEvidenceTypeDropdownOpen = false;
  isStatusDropdownOpen = false;
  
  // Handler para cerrar dropdowns al hacer clic fuera
  private clickHandler: (() => void) | null = null;

  // Para búsqueda
  searchTermEvidence: string = '';
  filterEvidenceType: string = 'all';
  filterStatus: string = 'all';

  constructor() {
    // Cerrar dropdowns al hacer clic fuera de ellos
    this.clickHandler = () => {
      this.isEvidenceTypeDropdownOpen = false;
      this.isStatusDropdownOpen = false;
    };
    document.addEventListener('click', this.clickHandler);
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Remover listener de clic para evitar memory leaks
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler);
    }
  }

  // ========================================
  // CARGA DE DATOS
  // ========================================

  private cargarDatos(): void {
    this.cargando = true;
    
    this.evidenceService.getAll().pipe(takeUntil(this.destroy$)).subscribe({
      next: (evidencias) => {
        this.evidenciasFiltradas = evidencias;
        this.filteredEvidences = evidencias; // Sincronizar para compatibilidad con HTML
        this.actualizarPaginacion();
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'Error al cargar las evidencias';
        this.cargando = false;
        console.error('Error cargando evidencias:', err);
      }
    });

    this.stats$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (stats) => {
        console.log('Estadísticas actualizadas:', stats);
        this.stats = stats;
      }
    });
  }

  // ========================================
  // FILTRADO
  // ========================================

  applyFilters(): void {
    this.cargando = true;
    this.currentPage = 1; // Resetear a primera página

    const filtros: EvidenciaFilters = {
      busqueda: this.searchTermEvidence,
      tipo: this.filterEvidenceType,
      estado: this.filterStatus,
      fechaInicio: null,
      fechaFin: null
    };

    console.log('Aplicando filtros:', filtros);

    this.evidenceService.filtrarEvidencias(filtros).pipe(takeUntil(this.destroy$)).subscribe({
      next: (evidencias) => {
        console.log('Evidencias filtradas:', evidencias.length, 'resultados');
        this.evidenciasFiltradas = evidencias;
        this.filteredEvidences = evidencias; // Sincronizar para compatibilidad con HTML
        this.actualizarPaginacion();
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'Error al filtrar evidencias';
        this.cargando = false;
        console.error('Error filtrando:', err);
      }
    });
  }

  clearFilters(): void {
    this.searchTermEvidence = '';
    this.filterEvidenceType = 'all';
    this.filterStatus = 'all';
    this.cargarDatos();
  }

  // ========================================
  // PAGINACIÓN
  // ========================================

  private actualizarPaginacion(): void {
    this.totalPages = Math.ceil(this.evidenciasFiltradas.length / this.itemsPerPage);
  }

  get paginatedEvidences(): Evidencia[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.evidenciasFiltradas.slice(startIndex, startIndex + this.itemsPerPage);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  getPagesArray(): number[] {
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  // ========================================
  // ACCIONES CRUD
  // ========================================

  verEvidencia(evidencia: Evidencia): void {
    this.evidenciaSeleccionada = evidencia;
    this.mostrarModalVer = true;
  }

  descargarEvidencia(id: number): void {
    this.cargando = true;
    this.evidenceService.descargar(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (blob) => {
        console.log('Blob recibido:', blob);
        const evidencia = this.evidenciaSeleccionada || this.evidenciasFiltradas.find(e => e.id === id);
        const nombreArchivo = evidencia?.nombre || `evidencia_${id}`;
        this.descargarArchivo(blob, nombreArchivo, evidencia?.tipo);
        // Las estadísticas se actualizan automáticamente en el servicio
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'Error al descargar evidencia';
        this.cargando = false;
        console.error('Error descargando:', err);
      }
    });
  }

  eliminarEvidencia(id: number): void {
    if (confirm('¿Estás seguro de eliminar esta evidencia?')) {
      this.cargando = true;
      this.evidenceService.delete(id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          // Recargar datos para actualizar la tabla y estadísticas
          this.cargarDatos();
          this.cargando = false;
        },
        error: (err) => {
          this.error = 'Error al eliminar evidencia';
          this.cargando = false;
          console.error('Error eliminando:', err);
        }
      });
    }
  }

  cambiarEstadoEvidencia(id: number, nuevoEstado: 'Verificada' | 'Pendiente' | 'Rechazada'): void {
    this.cargando = true;
    this.evidenceService.cambiarEstado(id, nuevoEstado).pipe(takeUntil(this.destroy$)).subscribe({
      next: (evidenciaActualizada) => {
        // Actualizar la evidencia seleccionada en el modal
        if (this.evidenciaSeleccionada && this.evidenciaSeleccionada.id === id) {
          this.evidenciaSeleccionada = evidenciaActualizada;
        }
        // Recargar datos para actualizar la tabla y estadísticas
        this.cargarDatos();
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'Error al cambiar estado';
        this.cargando = false;
        console.error('Error cambiando estado:', err);
      }
    });
  }

  private descargarArchivo(blob: Blob, nombre: string, tipo?: string): void {
    console.log('Iniciando descarga:', nombre, 'Tipo:', tipo, 'Tamaño blob:', blob.size);
    
    if (blob.size === 0) {
      // Generar contenido simulado según el tipo de archivo
      const contenido = this.generarContenidoSimulado(nombre, tipo);
      const mimeType = this.obtenerMimeType(tipo);
      const extension = this.obtenerExtension(tipo);
      
      const blobReal = new Blob([contenido], { type: mimeType });
      const url = window.URL.createObjectURL(blobReal);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre.endsWith(extension) ? nombre : nombre + extension;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      return;
    }
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  private generarContenidoSimulado(nombre: string, tipo?: string): string {
    const fecha = new Date().toLocaleString('es-ES');
    let contenido = `Evidencia: ${nombre}\n`;
    contenido += `Fecha de descarga: ${fecha}\n`;
    contenido += `Sistema: AlertaMujer\n\n`;
    contenido += `Esta es una evidencia de ejemplo generada por el sistema.\n`;
    contenido += `En producción, este archivo contendría el contenido real de la evidencia.\n`;
    
    if (tipo === 'video') {
      contenido += `\n[Contenido de video simulado]`;
    } else if (tipo === 'audio') {
      contenido += `\n[Contenido de audio simulado]`;
    } else if (tipo === 'documento') {
      contenido += `\n[Contenido de documento PDF simulado]`;
    } else if (tipo === 'foto') {
      contenido += `\n[Contenido de imagen simulado]`;
    }
    
    return contenido;
  }

  private obtenerMimeType(tipo?: string): string {
    switch (tipo) {
      case 'video':
        return 'video/mp4';
      case 'audio':
        return 'audio/mpeg';
      case 'documento':
        return 'application/pdf';
      case 'foto':
        return 'image/jpeg';
      default:
        return 'text/plain';
    }
  }

  private obtenerExtension(tipo?: string): string {
    switch (tipo) {
      case 'video':
        return '.mp4';
      case 'audio':
        return '.mp3';
      case 'documento':
        return '.pdf';
      case 'foto':
        return '.jpg';
      default:
        return '.txt';
    }
  }

  // ========================================
  // MODALES
  // ========================================

  cerrarModalVer(): void {
    this.mostrarModalVer = false;
    this.evidenciaSeleccionada = null;
  }

  // ========================================
  // DROPDOWNS PERSONALIZADOS
  // ========================================

  toggleEvidenceTypeDropdown(event: Event): void {
    event.stopPropagation();
    this.isEvidenceTypeDropdownOpen = !this.isEvidenceTypeDropdownOpen;
    this.isStatusDropdownOpen = false; // Cerrar el otro dropdown
  }

  toggleStatusDropdown(event: Event): void {
    event.stopPropagation();
    this.isStatusDropdownOpen = !this.isStatusDropdownOpen;
    this.isEvidenceTypeDropdownOpen = false; // Cerrar el otro dropdown
  }

  selectEvidenceType(tipo: string, event: Event): void {
    event.stopPropagation();
    this.filterEvidenceType = tipo;
    this.isEvidenceTypeDropdownOpen = false;
    console.log('Seleccionado tipo:', tipo);
    // No aplicar filtros automáticamente, esperar al botón Buscar
  }

  selectStatus(estado: string, event: Event): void {
    event.stopPropagation();
    this.filterStatus = estado;
    this.isStatusDropdownOpen = false;
    console.log('Seleccionado estado:', estado);
    // No aplicar filtros automáticamente, esperar al botón Buscar
  }

  getEvidenceTypeLabel(tipo: string): string {
    switch (tipo) {
      case 'all': return 'Todos los tipos';
      case 'foto': return 'Imagen';
      case 'video': return 'Video';
      case 'audio': return 'Audio';
      case 'documento': return 'Documento';
      default: return tipo;
    }
  }

  getStatusLabel(estado: string): string {
    switch (estado) {
      case 'all': return 'Todos los estados';
      case 'Verificada': return 'Verificada';
      case 'Pendiente': return 'Pendiente';
      case 'Rechazada': return 'Rechazada';
      default: return estado;
    }
  }

  // ========================================
  // UTILIDADES
  // ========================================

  getEvidenceTypeBadgeClass(tipo: string): string {
    switch (tipo) {
      case 'foto':
        return 'badge-image';
      case 'video':
        return 'badge-video';
      case 'audio':
        return 'badge-audio';
      case 'documento':
        return 'badge-document';
      default:
        return '';
    }
  }

  getEvidenceStatusBadgeClass(estado: string): string {
    switch (estado) {
      case 'Verificada':
        return 'status-verified';
      case 'Pendiente':
        return 'status-pending';
      case 'Rechazada':
        return 'status-rejected';
      default:
        return '';
    }
  }

  getEvidenceTypeDisplay(tipo: string): string {
    switch (tipo) {
      case 'foto':
        return 'Imagen';
      case 'video':
        return 'Video';
      case 'audio':
        return 'Audio';
      case 'documento':
        return 'Documento';
      default:
        return tipo;
    }
  }

  /**
   * Función trackBy para optimizar el rendimiento de las listas de Angular
   */
  trackByIndex(index: number): number {
    return index;
  }

  // Getters para compatibilidad con template
  get totalEvidences(): number {
    return this.stats.totalEvidencias;
  }

  get verifiedEvidences(): number {
    return this.stats.verificadas;
  }

  get pendingEvidences(): number {
    return this.stats.pendientes;
  }

  get rejectedEvidences(): number {
    return this.stats.rechazadas;
  }

  get totalDownloads(): number {
    return this.stats.descargas;
  }
}
