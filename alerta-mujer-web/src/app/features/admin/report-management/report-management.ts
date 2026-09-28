import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, takeUntil } from 'rxjs';
import { Reporte, ReporteFilters, ReporteStats, Paginacion } from '../../../core/models/report.model';
import { ReportsService } from '../../../core/services/reports.service';

@Component({
  selector: 'app-report-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './report-management.html',
  styleUrl: './report-management.scss',
})
export class ReportManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private reportsService = inject(ReportsService);

  // Datos
  reportes$: Observable<Reporte[]> = this.reportsService.reportes$;
  stats$: Observable<ReporteStats> = this.reportsService.getStats();
  
  reportesFiltrados: Reporte[] = [];
  stats: ReporteStats = {
    totalReportes: 0,
    totalAlertas: 0,
    zonasActivas: 0,
    exportaciones: 0
  };

  // Filtros
  filtros: ReporteFilters = {
    busqueda: '',
    fechaInicio: null,
    fechaFin: null,
    ciudad: '',
    estado: ''
  };

  // Paginación
  paginacion: Paginacion = {
    paginaActual: 1,
    elementosPorPagina: 5,
    totalElementos: 0,
    totalPaginas: 0
  };

  // Estados UI
  cargando = false;
  error = '';
  mostrarModalNuevo = false;
  mostrarModalVer = false;
  mostrarModalImpresora = false;
  reporteSeleccionado: Reporte | null = null;
  reporteEditando: Reporte | null = null;

  // Para formulario de nuevo reporte
  nuevoReporte: Partial<Reporte> = {
    nombre: '',
    ciudad: '',
    estado: 'Pendiente',
    usuaria: '',
    acontecimiento: '',
    formato: 'PDF',
    descripcion: ''
  };

  ngOnInit(): void {
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========================================
  // CARGA DE DATOS
  // ========================================

  private cargarDatos(): void {
    this.cargando = true;
    
    this.reportsService.getAll().pipe(takeUntil(this.destroy$)).subscribe({
      next: (reportes) => {
        this.reportesFiltrados = reportes;
        this.actualizarPaginacion();
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'Error al cargar los reportes';
        this.cargando = false;
        console.error('Error cargando reportes:', err);
      }
    });

    this.stats$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (stats) => {
        this.stats = stats;
      }
    });
  }

  // ========================================
  // FILTRADO
  // ========================================

  aplicarFiltros(): void {
    this.cargando = true;
    this.paginacion.paginaActual = 1; // Resetear a primera página

    this.reportsService.filtrarReportes(this.filtros).pipe(takeUntil(this.destroy$)).subscribe({
      next: (reportes) => {
        this.reportesFiltrados = reportes;
        this.actualizarPaginacion();
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'Error al filtrar reportes';
        this.cargando = false;
        console.error('Error filtrando:', err);
      }
    });
  }

  limpiarFiltros(): void {
    this.filtros = {
      busqueda: '',
      fechaInicio: null,
      fechaFin: null,
      ciudad: '',
      estado: ''
    };
    // Aplicar filtros con datos originales en lugar de filtrar con filtros vacíos
    this.cargarDatos();
  }

  onBusquedaChange(): void {
    // Debounce simple para búsqueda
    setTimeout(() => this.aplicarFiltros(), 300);
  }

  // ========================================
  // PAGINACIÓN
  // ========================================

  private actualizarPaginacion(): void {
    this.paginacion.totalElementos = this.reportesFiltrados.length;
    this.paginacion.totalPaginas = Math.ceil(
      this.paginacion.totalElementos / this.paginacion.elementosPorPagina
    );
  }

  get reportesPaginados(): Reporte[] {
    const inicio = (this.paginacion.paginaActual - 1) * this.paginacion.elementosPorPagina;
    const fin = inicio + this.paginacion.elementosPorPagina;
    return this.reportesFiltrados.slice(inicio, fin);
  }

  cambiarPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.paginacion.totalPaginas) {
      this.paginacion.paginaActual = pagina;
    }
  }

  irAPrimeraPagina(): void {
    this.cambiarPagina(1);
  }

  irAUltimaPagina(): void {
    this.cambiarPagina(this.paginacion.totalPaginas);
  }

  paginaAnterior(): void {
    this.cambiarPagina(this.paginacion.paginaActual - 1);
  }

  paginaSiguiente(): void {
    this.cambiarPagina(this.paginacion.paginaActual + 1);
  }

  // ========================================
  // EXPORTACIÓN
  // ========================================

  descargarPDF(id: number): void {
    this.cargando = true;
    this.reportsService.descargarPDF(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (blob) => {
        console.log('PDF blob recibido:', blob);
        this.descargarArchivo(blob, `reporte_${id}.pdf`);
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'Error al descargar PDF';
        this.cargando = false;
        console.error('Error descargando PDF:', err);
      }
    });
  }

  descargarExcel(id: number): void {
    this.cargando = true;
    this.reportsService.descargarExcel(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (blob) => {
        console.log('Excel blob recibido:', blob);
        this.descargarArchivo(blob, `reporte_${id}.xlsx`);
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'Error al descargar Excel';
        this.cargando = false;
        console.error('Error descargando Excel:', err);
      }
    });
  }

  generarReporteConFiltros(formato: 'PDF' | 'Excel'): void {
    this.cargando = true;
    
    // Crear nombre del reporte basado en filtros
    const nombreReporte = this.generarNombreReporte();
    
    const reporteACrear: Omit<Reporte, 'id'> = {
      nombre: nombreReporte,
      fecha: new Date(),
      ciudad: this.filtros.ciudad || 'Todas',
      estado: 'Pendiente',
      generadoPor: 'Administrador',
      formato: formato,
      tamano: 'Calculando...',
      descripcion: `Reporte generado con filtros: ${this.descripcionFiltros()}`
    };

    this.reportsService.create(reporteACrear).pipe(takeUntil(this.destroy$)).subscribe({
      next: (reporte) => {
        // Descargar el reporte recién creado
        if (formato === 'PDF') {
          this.descargarPDF(reporte.id);
        } else {
          this.descargarExcel(reporte.id);
        }
        this.cargarDatos();
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'Error al generar reporte';
        this.cargando = false;
        console.error('Error generando reporte:', err);
      }
    });
  }

  generarNombreReporte(): string {
    const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const ciudad = this.filtros.ciudad ? this.filtros.ciudad : 'Todas';
    const estado = this.filtros.estado ? this.filtros.estado : 'Todos';
    return `Reporte ${ciudad} - ${estado} - ${fecha}`;
  }

  descripcionFiltros(): string {
    const partes: string[] = [];
    if (this.filtros.ciudad) partes.push(`Ciudad: ${this.filtros.ciudad}`);
    if (this.filtros.estado) partes.push(`Estado: ${this.filtros.estado}`);
    if (this.filtros.fechaInicio) partes.push(`Desde: ${this.formatearFecha(this.filtros.fechaInicio)}`);
    if (this.filtros.fechaFin) partes.push(`Hasta: ${this.formatearFecha(this.filtros.fechaFin)}`);
    if (this.filtros.busqueda) partes.push(`Búsqueda: ${this.filtros.busqueda}`);
    return partes.length > 0 ? partes.join(', ') : 'Sin filtros';
  }

  imprimir(): void {
    // Verificar si hay impresora conectada
    if (this.verificarImpresora()) {
      window.print();
    } else {
      this.mostrarModalImpresora = true;
    }
  }

  verificarImpresora(): boolean {
    // Simulación de verificación de impresora
    // En un entorno real, esto podría usar la API de impresión del navegador
    // Aquí simulamos que NO hay impresora conectada para mostrar el modal
    return false; // Cambiar a true para imprimir directamente
  }

  cerrarModalImpresora(): void {
    this.mostrarModalImpresora = false;
  }

  private descargarArchivo(blob: Blob, nombre: string): void {
    console.log('Iniciando descarga:', nombre, 'Tamaño blob:', blob.size);
    
    if (blob.size === 0) {
      // Crear un archivo de ejemplo si el blob está vacío
      const contenido = `Reporte generado el ${new Date().toLocaleString('es-ES')}\n\nEste es un reporte de ejemplo generado por el sistema AlertaMujer.`;
      const blobReal = new Blob([contenido], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blobReal);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre.endsWith('.pdf') ? nombre : nombre.replace('.xlsx', '.txt');
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

  // ========================================
  // ACCIONES CRUD
  // ========================================

  verReporte(reporte: Reporte): void {
    this.reporteSeleccionado = reporte;
    this.mostrarModalVer = true;
  }

  editarReporte(reporte: Reporte): void {
    this.reporteEditando = { ...reporte };
    this.mostrarModalNuevo = true;
  }

  actualizarReporte(): void {
    if (!this.reporteEditando || !this.reporteEditando.id) {
      this.error = 'No hay reporte para actualizar';
      return;
    }

    this.cargando = true;
    const reporteActualizado: Reporte = {
      id: this.reporteEditando.id,
      nombre: this.modeloNombre,
      fecha: this.reporteEditando.fecha,
      ciudad: this.modeloCiudad,
      estado: this.modeloEstado as any,
      usuaria: this.modeloUsuaria,
      acontecimiento: this.modeloAcontecimiento,
      generadoPor: this.reporteEditando.generadoPor,
      formato: this.modeloFormato as any,
      tamano: this.reporteEditando.tamano,
      descripcion: this.modeloDescripcion
    };

    console.log('Actualizando reporte:', reporteActualizado);

    this.reportsService.update(reporteActualizado.id, reporteActualizado).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        console.log('Reporte actualizado exitosamente');
        this.cargarDatos();
        this.cerrarModalNuevo();
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'Error al actualizar reporte';
        this.cargando = false;
        console.error('Error actualizando:', err);
      }
    });
  }

  eliminarReporte(id: number): void {
    if (confirm('¿Estás seguro de eliminar este reporte?')) {
      this.cargando = true;
      this.reportsService.delete(id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.cargarDatos();
          this.cargando = false;
        },
        error: (err) => {
          this.error = 'Error al eliminar reporte';
          this.cargando = false;
          console.error('Error eliminando:', err);
        }
      });
    }
  }

  crearReporte(): void {
    this.cargando = true;
    const reporteACrear: Omit<Reporte, 'id'> = {
      nombre: this.modeloNombre || 'Reporte Sin Nombre',
      fecha: new Date(),
      ciudad: this.modeloCiudad || 'No especificada',
      estado: (this.modeloEstado || 'Pendiente') as 'Pendiente' | 'Cerrada' | 'Atendida',
      usuaria: this.modeloUsuaria,
      acontecimiento: this.modeloAcontecimiento,
      generadoPor: 'Administrador',
      formato: (this.modeloFormato || 'PDF') as 'PDF' | 'Excel' | 'CSV',
      tamano: 'Calculando...',
      descripcion: this.modeloDescripcion
    };

    console.log('Creando reporte:', reporteACrear);
    console.log('Valores del formulario:', {
      nombre: this.modeloNombre,
      ciudad: this.modeloCiudad,
      estado: this.modeloEstado,
      usuaria: this.modeloUsuaria,
      acontecimiento: this.modeloAcontecimiento
    });
    
    this.reportsService.create(reporteACrear).pipe(takeUntil(this.destroy$)).subscribe({
      next: (reporteCreado) => {
        console.log('Reporte creado exitosamente:', reporteCreado);
        this.cargarDatos();
        this.cerrarModalNuevo();
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'Error al crear reporte';
        this.cargando = false;
        console.error('Error creando:', err);
      }
    });
  }

  // ========================================
  // MODALES
  // ========================================

  abrirModalNuevo(): void {
    this.reporteEditando = null;
    this.nuevoReporte = {
      nombre: '',
      ciudad: '',
      estado: 'Pendiente',
      usuaria: '',
      acontecimiento: '',
      formato: 'PDF',
      descripcion: ''
    };
    this.mostrarModalNuevo = true;
  }

  cerrarModalNuevo(): void {
    this.mostrarModalNuevo = false;
    this.reporteEditando = null;
    this.nuevoReporte = {
      nombre: '',
      ciudad: '',
      estado: 'Pendiente',
      usuaria: '',
      acontecimiento: '',
      formato: 'PDF',
      descripcion: ''
    };
    this.error = '';
  }

  cerrarModalVer(): void {
    this.mostrarModalVer = false;
    this.reporteSeleccionado = null;
  }

  // ========================================
  // UTILIDADES
  // ========================================

  getStatusClass(estado: string): string {
    const clases: Record<string, string> = {
      'Pendiente': 'pending',
      'Cerrada': 'closed',
      'Atendida': 'attended'
    };
    return clases[estado] || 'pending';
  }

  formatearFecha(fecha: Date): string {
    return new Date(fecha).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  get paginasVisibles(): number[] {
    const paginas: number[] = [];
    const maxPaginasVisibles = 5;
    const mitad = Math.floor(maxPaginasVisibles / 2);
    
    let inicio = Math.max(1, this.paginacion.paginaActual - mitad);
    let fin = Math.min(this.paginacion.totalPaginas, inicio + maxPaginasVisibles - 1);
    
    if (fin - inicio < maxPaginasVisibles - 1) {
      inicio = Math.max(1, fin - maxPaginasVisibles + 1);
    }
    
    for (let i = inicio; i <= fin; i++) {
      paginas.push(i);
    }
    
    return paginas;
  }

  // Helpers para template
  get elementoInicio(): number {
    return (this.paginacion.paginaActual - 1) * this.paginacion.elementosPorPagina + 1;
  }

  get elementoFin(): number {
    return Math.min(this.paginacion.paginaActual * this.paginacion.elementosPorPagina, this.paginacion.totalElementos);
  }

  // Helpers para formularios en modales
  get modeloNombre(): string {
    return this.reporteEditando ? this.reporteEditando.nombre : this.nuevoReporte.nombre || '';
  }

  set modeloNombre(valor: string) {
    if (this.reporteEditando) {
      this.reporteEditando.nombre = valor;
    } else {
      this.nuevoReporte.nombre = valor;
    }
  }

  get modeloCiudad(): string {
    return this.reporteEditando ? this.reporteEditando.ciudad : this.nuevoReporte.ciudad || '';
  }

  set modeloCiudad(valor: string) {
    if (this.reporteEditando) {
      this.reporteEditando.ciudad = valor;
    } else {
      this.nuevoReporte.ciudad = valor;
    }
  }

  get modeloEstado(): string {
    return this.reporteEditando ? this.reporteEditando.estado : this.nuevoReporte.estado || 'Pendiente';
  }

  set modeloEstado(valor: string) {
    if (this.reporteEditando) {
      this.reporteEditando.estado = valor as any;
    } else {
      this.nuevoReporte.estado = valor as any;
    }
  }

  get modeloFormato(): string {
    return this.reporteEditando ? this.reporteEditando.formato : this.nuevoReporte.formato || 'PDF';
  }

  set modeloFormato(valor: string) {
    if (this.reporteEditando) {
      this.reporteEditando.formato = valor as any;
    } else {
      this.nuevoReporte.formato = valor as any;
    }
  }

  get modeloUsuaria(): string {
    return this.reporteEditando ? (this.reporteEditando.usuaria || '') : (this.nuevoReporte.usuaria || '');
  }

  set modeloUsuaria(valor: string) {
    if (this.reporteEditando) {
      this.reporteEditando.usuaria = valor;
    } else {
      this.nuevoReporte.usuaria = valor;
    }
  }

  get modeloAcontecimiento(): string {
    return this.reporteEditando ? (this.reporteEditando.acontecimiento || '') : (this.nuevoReporte.acontecimiento || '');
  }

  set modeloAcontecimiento(valor: string) {
    if (this.reporteEditando) {
      this.reporteEditando.acontecimiento = valor;
    } else {
      this.nuevoReporte.acontecimiento = valor;
    }
  }

  get modeloDescripcion(): string {
    return this.reporteEditando ? this.reporteEditando.descripcion || '' : this.nuevoReporte.descripcion || '';
  }

  set modeloDescripcion(valor: string) {
    if (this.reporteEditando) {
      this.reporteEditando.descripcion = valor;
    } else {
      this.nuevoReporte.descripcion = valor;
    }
  }
}
