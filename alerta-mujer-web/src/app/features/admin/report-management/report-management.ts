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
  /** Explanation of the section; remembered if the admin hid it. */
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
    status: ''
  };

  // Pagination
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

  // Alerts available for selection
  availableAlerts: Alert[] = [];
  selectedAlerts: number[] = []; // IDs de alertas seleccionadas
  loadingAlerts = false;

  // For the new report form
  newReport: Partial<AlertReport> = {
    name: '',
    city: '',
    status: 'Pendiente',
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
    this.pagination.currentPage = 1; // Reset to the first page

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
      status: ''
    };
    // Apply filters with the original data instead of filtering with empty filters
    this.loadData();
  }

  onSearchQueryChange(): void {
    // Simple debounce for search
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

  /** The backend returns a CSV that Excel opens directly. */
  downloadExcel(id: number): void {
    this.download(this.reportsService.downloadExcel(id), `informe-${id}.csv`, 'Error al descargar Excel');
  }

  private download(file$: Observable<Blob>, name: string, errorMessage: string): void {
    this.error = '';
    file$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (blob) => {
        this.downloadFile(blob, name);
        this.loadStats(); // each download adds one export
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
    
    // Create the report name based on the filters
    const reportName = this.generateReportName();
    
    const reportToCreate: Omit<AlertReport, 'id'> = {
      name: reportName,
      date: new Date(),
      city: this.filters.city || 'Todas',
      status: 'Pendiente',
      generatedBy: 'Administrador',
      format,
      size: '',
      description: `Reporte generado con filtros: ${this.filtersDescription()}`,
      // Without chosen alerts, the backend includes those in the date range
      from: this.filters.startDate ? new Date(`${this.filters.startDate}T00:00:00`) : null,
      to: this.filters.endDate ? new Date(`${this.filters.endDate}T23:59:59`) : null
    };

    this.reportsService.create(reportToCreate).pipe(takeUntil(this.destroy$)).subscribe({
      next: (report) => {
        // Download the report just created
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
    const date = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const city = this.filters.city ? this.filters.city : 'Todas';
    const status = this.filters.status ? this.filters.status : 'Todos';
    return `Reporte ${city} - ${status} - ${date}`;
  }

  filtersDescription(): string {
    const parts: string[] = [];
    if (this.filters.city) parts.push(`Ciudad: ${this.filters.city}`);
    if (this.filters.status) parts.push(`Estado: ${this.filters.status}`);
    if (this.filters.startDate) parts.push(`Desde: ${this.formatDate(this.filters.startDate)}`);
    if (this.filters.endDate) parts.push(`Hasta: ${this.formatDate(this.filters.endDate)}`);
    if (this.filters.search) parts.push(`Búsqueda: ${this.filters.search}`);
    return parts.length > 0 ? parts.join(', ') : 'Sin filtros';
  }

  print(): void {
    // Check whether a printer is connected
    if (this.checkPrinter()) {
      window.print();
    } else {
      this.showPrinterModal = true;
    }
  }

  checkPrinter(): boolean {
    // Printer check simulation
    // In a real environment, this could use the browser print API
    // Here we simulate that NO printer is connected to show the modal
    return false; // Cambiar a true para imprimir directamente
  }

  closePrinterModal(): void {
    this.showPrinterModal = false;
  }

  private downloadFile(blob: Blob, name: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
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
      name: this.nameModel,
      date: this.editingReport.date,
      city: this.cityModel,
      status: this.statusModel as any,
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
    
    // If there are selected alerts, generate data based on them
    let name = this.nameModel;
    let user = this.userModel;
    let incident = this.incidentModel;
    let city = this.cityModel || 'No especificada';
    let description = this.descriptionModel;

    if (this.selectedAlerts.length > 0) {
      const selectedAlertsObj = this.availableAlerts.filter(a => 
        this.selectedAlerts.includes(a.id)
      );
      
      if (selectedAlertsObj.length > 0) {
        // Generate an automatic name based on the alerts if there is no custom name
        if (!name) {
          const date = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
          const alertTypes = [...new Set(selectedAlertsObj.map(a => this.typeLabel(a.type)))].join(', ');
          name = `Reporte ${alertTypes} - ${date}`;
        }
        
        // Use the data of the first selected alert as the base
        if (!user) {
          user = [...new Set(selectedAlertsObj.map(a => a.name))].join(', ');
        }
        if (!incident) {
          incident = this.typeLabel(selectedAlertsObj[0].type);
        }
        if (!description) {
          description = `Reporte basado en ${this.selectedAlerts.length} alerta(s)`;
        }
      }
    }

    const reportToCreate: Omit<AlertReport, 'id'> = {
      name: name || 'Reporte Sin Nombre',
      date: new Date(),
      city,
      status: (this.statusModel || 'Pendiente') as 'Pendiente' | 'Cerrada' | 'Atendida',
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
      name: '',
      city: '',
      status: 'Pendiente',
      user: '',
      incident: '',
      description: ''
    };
    this.selectedAlerts = []; // Reset the alert selection
    this.showNewModal = true;
  }

  closeNewModal(): void {
    this.showNewModal = false;
    this.editingReport = null;
    this.newReport = {
      name: '',
      city: '',
      status: 'Pendiente',
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

  /** Readable name of the alert type the mobile app sends. */
  typeLabel(type: string): string {
    const labels: Record<string, string> = { main: 'Alerta SOS', mini: 'Mini alerta', reminder: 'Recordatorio' };
    return labels[type] || type || 'Alerta';
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      'Pendiente': 'pending',
      'Cerrada': 'closed',
      'Atendida': 'attended'
    };
    return classes[status] || 'pending';
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleString('es-ES', {
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

  // Helpers for forms in modals
  get nameModel(): string {
    return this.editingReport ? this.editingReport.name : this.newReport.name || '';
  }

  set nameModel(value: string) {
    if (this.editingReport) {
      this.editingReport.name = value;
    } else {
      this.newReport.name = value;
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
    return this.editingReport ? this.editingReport.status : this.newReport.status || 'Pendiente';
  }

  set statusModel(value: string) {
    if (this.editingReport) {
      this.editingReport.status = value as any;
    } else {
      this.newReport.status = value as any;
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
  // ALERT MANAGEMENT
  // ========================================

  toggleAlertSelected(alertId: number): void {
    const index = this.selectedAlerts.indexOf(alertId);
    if (index === -1) {
      this.selectedAlerts.push(alertId);
    } else {
      this.selectedAlerts.splice(index, 1);
    }
  }

  isAlertSelected(alertId: number): boolean {
    return this.selectedAlerts.includes(alertId);
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
