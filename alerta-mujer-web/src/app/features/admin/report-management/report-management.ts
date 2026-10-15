import { ChangeDetectorRef, Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, takeUntil } from 'rxjs';
import { Reporte, ReporteFilters, ReporteStats, Paginacion } from '../../../core/models/report.model';
import { ReportsService } from '../../../core/services/reports.service';
import { AlertsService } from '../../../core/services/alerts.services';
import { Alerta } from '../../../core/models/alert.model';

@Component({
  selector: 'app-report-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './report-management.html',
  styleUrl: './report-management.scss',
})
export class ReportManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private reportsService = inject(ReportsService);
  private alertsService = inject(AlertsService);
  private cdr = inject(ChangeDetectorRef);

  // Datos
  reportes$: Observable<Reporte[]> = this.reportsService.reportes$;
  
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

  // Alertas disponibles para selección
  alertasDisponibles: Alerta[] = [];
  alertasSeleccionadas: number[] = []; // IDs de alertas seleccionadas
  cargandoAlertas = false;

  // Para formulario de nuevo reporte
  nuevoReporte: Partial<Reporte> = {
    nombre: '',
    ciudad: '',
    estado: 'Pendiente',
    usuaria: '',
    acontecimiento: '',
    descripcion: ''
  };

  ngOnInit(): void {
    this.cargarDatos();
    this.cargarAlertas();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========================================
  // CARGA DE DATOS
  // ========================================

  private cargarAlertas(): void {
    this.cargandoAlertas = true;
    this.alertsService.getAll().pipe(takeUntil(this.destroy$)).subscribe({
      next: (alertas) => {
        this.alertasDisponibles = alertas;
        this.cargandoAlertas = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando alertas:', err);
        this.cargandoAlertas = false;
        this.cdr.detectChanges();
      }
    });
  }

  private cargarDatos(): void {
    this.cargando = true;
    
    this.reportsService.getAll().pipe(takeUntil(this.destroy$)).subscribe({
      next: (reportes) => {
        this.reportesFiltrados = reportes;
        this.actualizarPaginacion();
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Error al cargar los reportes';
        this.cargando = false;
        this.cdr.detectChanges();
        console.error('Error cargando reportes:', err);
      }
    });

    this.cargarEstadisticas();
  }

  private cargarEstadisticas(): void {
    this.reportsService.getStats().pipe(takeUntil(this.destroy$)).subscribe({
      next: (stats) => {
        this.stats = stats;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error cargando estadísticas:', err)
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
        this.cdr.detectChanges();
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
    this.descargar(this.reportsService.descargarPDF(id), `informe-${id}.pdf`, 'Error al descargar PDF');
  }

  /** El backend entrega un CSV que Excel abre directamente. */
  descargarExcel(id: number): void {
    this.descargar(this.reportsService.descargarExcel(id), `informe-${id}.csv`, 'Error al descargar Excel');
  }

  private descargar(archivo$: Observable<Blob>, nombre: string, mensajeError: string): void {
    this.error = '';
    archivo$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (blob) => {
        this.descargarArchivo(blob, nombre);
        this.cargarEstadisticas(); // cada descarga suma una exportación
      },
      error: (err) => {
        this.error = mensajeError;
        this.cdr.detectChanges();
        console.error(mensajeError, err);
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
      tamano: '',
      descripcion: `Reporte generado con filtros: ${this.descripcionFiltros()}`,
      // Sin alertas elegidas, el backend incluye las del rango de fechas
      desde: this.filtros.fechaInicio ? new Date(`${this.filtros.fechaInicio}T00:00:00`) : null,
      hasta: this.filtros.fechaFin ? new Date(`${this.filtros.fechaFin}T23:59:59`) : null
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
        this.error = err?.error?.message || 'Error al generar reporte';
        this.cargando = false;
        this.cdr.detectChanges();
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
    this.alertasSeleccionadas = [...(reporte.alertasIds ?? [])];
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
      formato: this.reporteEditando.formato, // Mantener el formato original
      tamano: this.reporteEditando.tamano,
      descripcion: this.modeloDescripcion,
      alertasIds: [...this.alertasSeleccionadas]
    };

    this.reportsService.update(reporteActualizado.id, reporteActualizado).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.cargarDatos();
        this.cerrarModalNuevo();
        this.cargando = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al actualizar reporte';
        this.cargando = false;
        this.cdr.detectChanges();
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
          this.error = err?.error?.message || 'Error al eliminar reporte';
          this.cargando = false;
          this.cdr.detectChanges();
          console.error('Error eliminando:', err);
        }
      });
    }
  }

  crearReporte(): void {
    this.cargando = true;
    
    // Si hay alertas seleccionadas, generar datos basados en ellas
    let nombre = this.modeloNombre;
    let usuaria = this.modeloUsuaria;
    let acontecimiento = this.modeloAcontecimiento;
    let ciudad = this.modeloCiudad || 'No especificada';
    let descripcion = this.modeloDescripcion;

    if (this.alertasSeleccionadas.length > 0) {
      const alertasSeleccionadasObj = this.alertasDisponibles.filter(a => 
        this.alertasSeleccionadas.includes(a.id)
      );
      
      if (alertasSeleccionadasObj.length > 0) {
        // Generar nombre automático basado en alertas si no hay nombre personalizado
        if (!nombre) {
          const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
          const tiposAlertas = [...new Set(alertasSeleccionadasObj.map(a => this.etiquetaTipo(a.tipo)))].join(', ');
          nombre = `Reporte ${tiposAlertas} - ${fecha}`;
        }
        
        // Usar datos de la primera alerta seleccionada como base
        if (!usuaria) {
          usuaria = [...new Set(alertasSeleccionadasObj.map(a => a.nombre))].join(', ');
        }
        if (!acontecimiento) {
          acontecimiento = this.etiquetaTipo(alertasSeleccionadasObj[0].tipo);
        }
        if (!descripcion) {
          descripcion = `Reporte basado en ${this.alertasSeleccionadas.length} alerta(s)`;
        }
      }
    }

    const reporteACrear: Omit<Reporte, 'id'> = {
      nombre: nombre || 'Reporte Sin Nombre',
      fecha: new Date(),
      ciudad: ciudad,
      estado: (this.modeloEstado || 'Pendiente') as 'Pendiente' | 'Cerrada' | 'Atendida',
      usuaria: usuaria,
      acontecimiento: acontecimiento,
      generadoPor: 'Administrador',
      formato: 'PDF' as 'PDF' | 'Excel' | 'CSV', // Formato por defecto
      tamano: '',
      descripcion: descripcion,
      alertasIds: this.alertasSeleccionadas.length > 0 ? this.alertasSeleccionadas : undefined
    };

    this.reportsService.create(reporteACrear).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.cargarDatos();
        this.cerrarModalNuevo();
        this.cargando = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al crear reporte';
        this.cargando = false;
        this.cdr.detectChanges();
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
      descripcion: ''
    };
    this.alertasSeleccionadas = []; // Resetear selección de alertas
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
      descripcion: ''
    };
    this.alertasSeleccionadas = [];
    this.error = '';
  }

  cerrarModalVer(): void {
    this.mostrarModalVer = false;
    this.reporteSeleccionado = null;
  }

  // ========================================
  // UTILIDADES
  // ========================================

  /** Nombre legible del tipo de alerta que envía la app móvil. */
  etiquetaTipo(tipo: string): string {
    const etiquetas: Record<string, string> = { main: 'Alerta SOS', mini: 'Mini alerta', reminder: 'Recordatorio' };
    return etiquetas[tipo] || tipo || 'Alerta';
  }

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

  // ========================================
  // GESTIÓN DE ALERTAS
  // ========================================

  toggleAlertaSeleccionada(alertaId: number): void {
    const index = this.alertasSeleccionadas.indexOf(alertaId);
    if (index === -1) {
      this.alertasSeleccionadas.push(alertaId);
    } else {
      this.alertasSeleccionadas.splice(index, 1);
    }
  }

  isAlertaSeleccionada(alertaId: number): boolean {
    return this.alertasSeleccionadas.includes(alertaId);
  }

  seleccionarTodasAlertas(): void {
    this.alertasSeleccionadas = this.alertasDisponibles.map(a => a.id);
  }

  deseleccionarTodasAlertas(): void {
    this.alertasSeleccionadas = [];
  }

  get alertasSeleccionadasCount(): number {
    return this.alertasSeleccionadas.length;
  }
}
