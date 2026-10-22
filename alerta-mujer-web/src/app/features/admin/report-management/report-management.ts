import { ChangeDetectorRef, Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, takeUntil } from 'rxjs';
import { AlertReport, ReportFilters, ReportStats, Pagination } from '../../../core/models/report.model';
import { ReportsService } from '../../../core/services/reports.service';
import { AlertsService } from '../../../core/services/alerts.services';
import { Alert } from '../../../core/models/alert.model';
import { DatePicker } from '../../../shared/components/selector-fecha/selector-fecha';
import { compactPages } from '../../../shared/utils/paginacion';

@Component({
  selector: 'app-report-management',
  imports: [DatePicker, CommonModule, FormsModule],
  templateUrl: './report-management.html',
  styleUrl: './report-management.scss',
})
export class ReportManagementComponent implements OnInit, OnDestroy {
  /** Explicación de la sección; se recuerda si la administradora la ocultó. */
  showHelp = (() => {
    try {
      return localStorage.getItem('informes-ayuda-oculta') !== '1';
    } catch {
      return true;
    }
  })();

  hideHelp(): void {
    this.showHelp = false;
    try { localStorage.setItem('informes-ayuda-oculta', '1'); } catch { /* modo privado */ }
  }

  showHelpAgain(): void {
    this.showHelp = true;
    try { localStorage.removeItem('informes-ayuda-oculta'); } catch { /* modo privado */ }
  }

  private destroy$ = new Subject<void>();
  private reportsService = inject(ReportsService);
  private alertsService = inject(AlertsService);
  private cdr = inject(ChangeDetectorRef);

  // Datos
  reports$: Observable<AlertReport[]> = this.reportsService.reports$;
  
  filteredReports: AlertReport[] = [];
  stats: ReportStats = {
    totalReportCount: 0,
    totalAlertCount: 0,
    activeZones: 0,
    exports: 0
  };

  // Filtros
  filters: ReportFilters = {
    search: '',
    startDate: null,
    endDate: null,
    city: '',
    estado: ''
  };

  // Paginación
  pagination: Pagination = {
    currentPage: 1,
    itemsPerPage: 5,
    totalElements: 0,
    totalPageCount: 0
  };

  // Estados UI
  loading = false;
  error = '';
  showNewModal = false;
  showViewModal = false;
  showPrinterModal = false;
  selectedReport: AlertReport | null = null;
  editingReport: AlertReport | null = null;

  // Alertas disponibles para selección
  availableAlerts: Alert[] = [];
  selectedAlerts: number[] = []; // IDs de alertas seleccionadas
  loadingAlerts = false;

  // Para formulario de nuevo reporte
  newReport: Partial<AlertReport> = {
    nombre: '',
    city: '',
    estado: 'Pendiente',
    user: '',
    incident: '',
    description: ''
  };

  ngOnInit(): void {
    this.loadData();
    this.loadAlerts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========================================
  // CARGA DE DATOS
  // ========================================

  private loadAlerts(): void {
    this.loadingAlerts = true;
    this.alertsService.getAll().pipe(takeUntil(this.destroy$)).subscribe({
      next: (alerts) => {
        this.availableAlerts = alerts;
        this.loadingAlerts = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando alertas:', err);
        this.loadingAlerts = false;
        this.cdr.detectChanges();
      }
    });
  }

  private loadData(): void {
    this.loading = true;
    
    this.reportsService.getAll().pipe(takeUntil(this.destroy$)).subscribe({
      next: (reports) => {
        this.filteredReports = reports;
        this.updatePagination();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Error al cargar los reportes';
        this.loading = false;
        this.cdr.detectChanges();
        console.error('Error cargando reportes:', err);
      }
    });

    this.loadStats();
  }

  private loadStats(): void {
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

  applyFilters(): void {
    this.loading = true;
    this.pagination.currentPage = 1; // Resetear a primera página

    this.reportsService.filterReports(this.filters).pipe(takeUntil(this.destroy$)).subscribe({
      next: (reports) => {
        this.filteredReports = reports;
        this.updatePagination();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Error al filtrar reportes';
        this.loading = false;
        console.error('Error filtrando:', err);
      }
    });
  }

  clearFilters(): void {
    this.filters = {
      search: '',
      startDate: null,
      endDate: null,
      city: '',
      estado: ''
    };
    // Aplicar filtros con datos originales en lugar de filtrar con filtros vacíos
    this.loadData();
  }

  onSearchQueryChange(): void {
    // Debounce simple para búsqueda
    setTimeout(() => this.applyFilters(), 300);
  }

  // ========================================
  // PAGINACIÓN
  // ========================================

  private updatePagination(): void {
    this.pagination.totalElements = this.filteredReports.length;
    this.pagination.totalPageCount = Math.ceil(
      this.pagination.totalElements / this.pagination.itemsPerPage
    );
  }

  get pagedReports(): AlertReport[] {
    const start = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage;
    const end = start + this.pagination.itemsPerPage;
    return this.filteredReports.slice(start, end);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.pagination.totalPageCount) {
      this.pagination.currentPage = page;
    }
  }

  goToFirstPage(): void {
    this.changePage(1);
  }

  goToLastPage(): void {
    this.changePage(this.pagination.totalPageCount);
  }

  previousPage(): void {
    this.changePage(this.pagination.currentPage - 1);
  }

  nextPage(): void {
    this.changePage(this.pagination.currentPage + 1);
  }

  // ========================================
  // EXPORTACIÓN
  // ========================================

  downloadPdf(id: number): void {
    this.download(this.reportsService.downloadPdf(id), `informe-${id}.pdf`, 'Error al descargar PDF');
  }

  /** El backend entrega un CSV que Excel abre directamente. */
  downloadExcel(id: number): void {
    this.download(this.reportsService.downloadExcel(id), `informe-${id}.csv`, 'Error al descargar Excel');
  }

  private download(file$: Observable<Blob>, nombre: string, errorMessage: string): void {
    this.error = '';
    file$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (blob) => {
        this.downloadFile(blob, nombre);
        this.loadStats(); // cada descarga suma una exportación
      },
      error: (err) => {
        this.error = errorMessage;
        this.cdr.detectChanges();
        console.error(errorMessage, err);
      }
    });
  }

  generateFilteredReport(format: 'PDF' | 'Excel'): void {
    this.loading = true;
    
    // Crear nombre del reporte basado en filtros
    const reportName = this.generateReportName();
    
    const reportToCreate: Omit<AlertReport, 'id'> = {
      nombre: reportName,
      fecha: new Date(),
      city: this.filters.city || 'Todas',
      estado: 'Pendiente',
      generatedBy: 'Administrador',
      format,
      size: '',
      description: `Reporte generado con filtros: ${this.filtersDescription()}`,
      // Sin alertas elegidas, el backend incluye las del rango de fechas
      from: this.filters.startDate ? new Date(`${this.filters.startDate}T00:00:00`) : null,
      to: this.filters.endDate ? new Date(`${this.filters.endDate}T23:59:59`) : null
    };

    this.reportsService.create(reportToCreate).pipe(takeUntil(this.destroy$)).subscribe({
      next: (report) => {
        // Descargar el reporte recién creado
        if (format === 'PDF') {
          this.downloadPdf(report.id);
        } else {
          this.downloadExcel(report.id);
        }
        this.loadData();
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al generar reporte';
        this.loading = false;
        this.cdr.detectChanges();
        console.error('Error generando reporte:', err);
      }
    });
  }

  generateReportName(): string {
    const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const city = this.filters.city ? this.filters.city : 'Todas';
    const estado = this.filters.estado ? this.filters.estado : 'Todos';
    return `Reporte ${city} - ${estado} - ${fecha}`;
  }

  filtersDescription(): string {
    const parts: string[] = [];
    if (this.filters.city) parts.push(`Ciudad: ${this.filters.city}`);
    if (this.filters.estado) parts.push(`Estado: ${this.filters.estado}`);
    if (this.filters.startDate) parts.push(`Desde: ${this.formatDate(this.filters.startDate)}`);
    if (this.filters.endDate) parts.push(`Hasta: ${this.formatDate(this.filters.endDate)}`);
    if (this.filters.search) parts.push(`Búsqueda: ${this.filters.search}`);
    return parts.length > 0 ? parts.join(', ') : 'Sin filtros';
  }

  print(): void {
    // Verificar si hay impresora conectada
    if (this.checkPrinter()) {
      window.print();
    } else {
      this.showPrinterModal = true;
    }
  }

  checkPrinter(): boolean {
    // Simulación de verificación de impresora
    // En un entorno real, esto podría usar la API de impresión del navegador
    // Aquí simulamos que NO hay impresora conectada para mostrar el modal
    return false; // Cambiar a true para imprimir directamente
  }

  closePrinterModal(): void {
    this.showPrinterModal = false;
  }

  private downloadFile(blob: Blob, nombre: string): void {
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

  viewReport(report: AlertReport): void {
    this.selectedReport = report;
    this.showViewModal = true;
  }

  editReport(report: AlertReport): void {
    this.editingReport = { ...report };
    this.selectedAlerts = [...(report.alertIdList ?? [])];
    this.showNewModal = true;
  }

  updateReport(): void {
    if (!this.editingReport || !this.editingReport.id) {
      this.error = 'No hay reporte para actualizar';
      return;
    }

    this.loading = true;
    const updatedReport: AlertReport = {
      id: this.editingReport.id,
      nombre: this.nameModel,
      fecha: this.editingReport.fecha,
      city: this.cityModel,
      estado: this.statusModel as any,
      user: this.userModel,
      incident: this.incidentModel,
      generatedBy: this.editingReport.generatedBy,
      format: this.editingReport.format, // Mantener el formato original
      size: this.editingReport.size,
      description: this.descriptionModel,
      alertIdList: [...this.selectedAlerts]
    };

    this.reportsService.update(updatedReport.id, updatedReport).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.loadData();
        this.closeNewModal();
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al actualizar reporte';
        this.loading = false;
        this.cdr.detectChanges();
        console.error('Error actualizando:', err);
      }
    });
  }

  deleteReport(id: number): void {
    if (confirm('¿Estás seguro de eliminar este reporte?')) {
      this.loading = true;
      this.reportsService.delete(id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.loadData();
          this.loading = false;
        },
        error: (err) => {
          this.error = err?.error?.message || 'Error al eliminar reporte';
          this.loading = false;
          this.cdr.detectChanges();
          console.error('Error eliminando:', err);
        }
      });
    }
  }

  createReport(): void {
    this.loading = true;
    
    // Si hay alertas seleccionadas, generar datos basados en ellas
    let nombre = this.nameModel;
    let user = this.userModel;
    let incident = this.incidentModel;
    let city = this.cityModel || 'No especificada';
    let description = this.descriptionModel;

    if (this.selectedAlerts.length > 0) {
      const selectedAlertsObj = this.availableAlerts.filter(a => 
        this.selectedAlerts.includes(a.id)
      );
      
      if (selectedAlertsObj.length > 0) {
        // Generar nombre automático basado en alertas si no hay nombre personalizado
        if (!nombre) {
          const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
          const alertTypes = [...new Set(selectedAlertsObj.map(a => this.typeLabel(a.tipo)))].join(', ');
          nombre = `Reporte ${alertTypes} - ${fecha}`;
        }
        
        // Usar datos de la primera alerta seleccionada como base
        if (!user) {
          user = [...new Set(selectedAlertsObj.map(a => a.nombre))].join(', ');
        }
        if (!incident) {
          incident = this.typeLabel(selectedAlertsObj[0].tipo);
        }
        if (!description) {
          description = `Reporte basado en ${this.selectedAlerts.length} alerta(s)`;
        }
      }
    }

    const reportToCreate: Omit<AlertReport, 'id'> = {
      nombre: nombre || 'Reporte Sin Nombre',
      fecha: new Date(),
      city,
      estado: (this.statusModel || 'Pendiente') as 'Pendiente' | 'Cerrada' | 'Atendida',
      user,
      incident,
      generatedBy: 'Administrador',
      format: 'PDF' as 'PDF' | 'Excel' | 'CSV', // Formato por defecto
      size: '',
      description,
      alertIdList: this.selectedAlerts.length > 0 ? this.selectedAlerts : undefined
    };

    this.reportsService.create(reportToCreate).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.loadData();
        this.closeNewModal();
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al crear reporte';
        this.loading = false;
        this.cdr.detectChanges();
        console.error('Error creando:', err);
      }
    });
  }

  // ========================================
  // MODALES
  // ========================================

  openNewModal(): void {
    this.editingReport = null;
    this.newReport = {
      nombre: '',
      city: '',
      estado: 'Pendiente',
      user: '',
      incident: '',
      description: ''
    };
    this.selectedAlerts = []; // Resetear selección de alertas
    this.showNewModal = true;
  }

  closeNewModal(): void {
    this.showNewModal = false;
    this.editingReport = null;
    this.newReport = {
      nombre: '',
      city: '',
      estado: 'Pendiente',
      user: '',
      incident: '',
      description: ''
    };
    this.selectedAlerts = [];
    this.error = '';
  }

  closeViewModal(): void {
    this.showViewModal = false;
    this.selectedReport = null;
  }

  // ========================================
  // UTILIDADES
  // ========================================

  /** Nombre legible del tipo de alerta que envía la app móvil. */
  typeLabel(tipo: string): string {
    const labels: Record<string, string> = { main: 'Alerta SOS', mini: 'Mini alerta', reminder: 'Recordatorio' };
    return labels[tipo] || tipo || 'Alerta';
  }

  getStatusClass(estado: string): string {
    const classes: Record<string, string> = {
      'Pendiente': 'pending',
      'Cerrada': 'closed',
      'Atendida': 'attended'
    };
    return classes[estado] || 'pending';
  }

  formatDate(fecha: Date): string {
    return new Date(fecha).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  get visiblePages(): (number | null)[] {
    return compactPages(this.pagination.currentPage, this.pagination.totalPageCount);
  }

  // Helpers para template
  get startItem(): number {
    if (this.pagination.totalElements === 0) return 0;
    return (this.pagination.currentPage - 1) * this.pagination.itemsPerPage + 1;
  }

  get endItem(): number {
    return Math.min(this.pagination.currentPage * this.pagination.itemsPerPage, this.pagination.totalElements);
  }

  // Helpers para formularios en modales
  get nameModel(): string {
    return this.editingReport ? this.editingReport.nombre : this.newReport.nombre || '';
  }

  set nameModel(value: string) {
    if (this.editingReport) {
      this.editingReport.nombre = value;
    } else {
      this.newReport.nombre = value;
    }
  }

  get cityModel(): string {
    return this.editingReport ? this.editingReport.city : this.newReport.city || '';
  }

  set cityModel(value: string) {
    if (this.editingReport) {
      this.editingReport.city = value;
    } else {
      this.newReport.city = value;
    }
  }

  get statusModel(): string {
    return this.editingReport ? this.editingReport.estado : this.newReport.estado || 'Pendiente';
  }

  set statusModel(value: string) {
    if (this.editingReport) {
      this.editingReport.estado = value as any;
    } else {
      this.newReport.estado = value as any;
    }
  }

  get userModel(): string {
    return this.editingReport ? (this.editingReport.user || '') : (this.newReport.user || '');
  }

  set userModel(value: string) {
    if (this.editingReport) {
      this.editingReport.user = value;
    } else {
      this.newReport.user = value;
    }
  }

  get incidentModel(): string {
    return this.editingReport ? (this.editingReport.incident || '') : (this.newReport.incident || '');
  }

  set incidentModel(value: string) {
    if (this.editingReport) {
      this.editingReport.incident = value;
    } else {
      this.newReport.incident = value;
    }
  }

  get descriptionModel(): string {
    return this.editingReport ? this.editingReport.description || '' : this.newReport.description || '';
  }

  set descriptionModel(value: string) {
    if (this.editingReport) {
      this.editingReport.description = value;
    } else {
      this.newReport.description = value;
    }
  }

  // ========================================
  // GESTIÓN DE ALERTAS
  // ========================================

  toggleAlertSelected(alertaId: number): void {
    const index = this.selectedAlerts.indexOf(alertaId);
    if (index === -1) {
      this.selectedAlerts.push(alertaId);
    } else {
      this.selectedAlerts.splice(index, 1);
    }
  }

  isAlertSelected(alertaId: number): boolean {
    return this.selectedAlerts.includes(alertaId);
  }

  selectAllAlerts(): void {
    this.selectedAlerts = this.availableAlerts.map(a => a.id);
  }

  deselectAllAlerts(): void {
    this.selectedAlerts = [];
  }

  get selectedAlertsCount(): number {
    return this.selectedAlerts.length;
  }
}
