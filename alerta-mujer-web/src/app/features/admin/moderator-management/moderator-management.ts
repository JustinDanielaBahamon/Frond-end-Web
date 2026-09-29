import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { ModeratorService, Report } from '../../../core/services/moderator.service';

@Component({
  selector: 'app-moderator-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './moderator-management.html',
  styleUrl: './moderator-management.scss',
})
export class ModeratorManagementComponent implements OnInit, OnDestroy {
  reports: Report[] = [];
  allReports: Report[] = []; // Guardar todos los reportes para filtrado
  filteredReports: Report[] = []; // Reportes filtrados actuales
  stats = {
    pendingReports: 0,
    resolvedCases: 0,
    sanctionedUsers: 0
  };

  currentPage = 1;
  totalPages = 5;
  itemsPerPage = 7;
  totalItems = 32;

  // Estados UI
  mostrarModalVer = false;
  mostrarModalEditar = false;
  mostrarModalAgregar = false;
  reporteSeleccionado: Report | null = null;
  nuevoReporte: Partial<Report> | null = null;

  // Filtros
  searchTerm = '';
  filterReason = '';
  filterSeverity = '';
  filterStatus = '';
  filterDate = '';

  // Estados de dropdowns personalizados (filtros del toolbar)
  isReasonDropdownOpen = false;
  isSeverityDropdownOpen = false;
  isStatusDropdownOpen = false;

  // Estados de dropdowns del modal de editar
  isEditReasonDropdownOpen = false;
  isEditSeverityDropdownOpen = false;
  isEditStatusDropdownOpen = false;

  private destroy$ = new Subject<void>();

  constructor(private moderatorService: ModeratorService) {
    // Cerrar dropdowns al hacer clic fuera
    this.clickHandler = () => {
      this.isReasonDropdownOpen = false;
      this.isSeverityDropdownOpen = false;
      this.isStatusDropdownOpen = false;
    };
    document.addEventListener('click', this.clickHandler);
  }

  ngOnInit(): void {
    this.loadReports();
    this.loadStats();
  }

  ngOnDestroy(): void {
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========================================
  // CARGAR DATOS DEL SERVICIO
  // ========================================

  loadReports(): void {
    this.moderatorService.getAll().subscribe(reports => {
      this.allReports = reports;
      this.filteredReports = reports;
      this.reports = reports;
      this.totalItems = reports.length;
      this.totalPages = Math.ceil(reports.length / this.itemsPerPage);
      this.calculateStats();
    });
  }

  loadStats(): void {
    this.calculateStats();
  }

  calculateStats(): void {
    const reports = this.allReports;
    this.stats = {
      pendingReports: reports.filter(r => r.status === 'Pendiente').length,
      resolvedCases: reports.filter(r => r.status === 'Resuelto').length,
      sanctionedUsers: reports.filter(r => r.status === 'Resuelto').length
    };
  }

  private clickHandler: (() => void) | null = null;

  // ========================================
  // DROPDOWNS PERSONALIZADOS
  // ========================================

  toggleReasonDropdown(event: Event): void {
    event.stopPropagation();
    this.isReasonDropdownOpen = !this.isReasonDropdownOpen;
  }

  selectReason(reason: string, event: Event): void {
    event.stopPropagation();
    this.filterReason = reason;
    this.isReasonDropdownOpen = false;
    this.applyFilters();
  }

  getReasonLabel(reason: string): string {
    switch (reason) {
      case '': return 'Motivo de reporte';
      case 'all': return 'Todos';
      case 'spam': return 'Spam';
      case 'acoso': return 'Acoso';
      case 'contenido-inapropiado': return 'Contenido inapropiado';
      case 'discurso-odio': return 'Discurso de odio';
      case 'falsificacion': return 'Falsificación';
      default: return reason;
    }
  }

  toggleSeverityDropdown(event: Event): void {
    event.stopPropagation();
    this.isSeverityDropdownOpen = !this.isSeverityDropdownOpen;
  }

  selectSeverity(severity: string, event: Event): void {
    event.stopPropagation();
    this.filterSeverity = severity;
    this.isSeverityDropdownOpen = false;
    this.applyFilters();
  }

  getSeverityLabel(severity: string): string {
    switch (severity) {
      case '': return 'Gravedad';
      case 'all': return 'Todas';
      case 'baja': return 'Baja';
      case 'media': return 'Media';
      case 'alta': return 'Alta';
      case 'critica': return 'Crítica';
      default: return severity;
    }
  }

  toggleStatusDropdown(event: Event): void {
    event.stopPropagation();
    this.isStatusDropdownOpen = !this.isStatusDropdownOpen;
  }

  selectStatus(status: string, event: Event): void {
    event.stopPropagation();
    this.filterStatus = status;
    this.isStatusDropdownOpen = false;
    this.applyFilters();
  }

  // Métodos para editar reporte seleccionado
  toggleEditReasonDropdown(event: Event): void {
    event.stopPropagation();
    this.isEditReasonDropdownOpen = !this.isEditReasonDropdownOpen;
    this.isEditSeverityDropdownOpen = false;
    this.isEditStatusDropdownOpen = false;
  }

  toggleEditSeverityDropdown(event: Event): void {
    event.stopPropagation();
    this.isEditSeverityDropdownOpen = !this.isEditSeverityDropdownOpen;
    this.isEditReasonDropdownOpen = false;
    this.isEditStatusDropdownOpen = false;
  }

  toggleEditStatusDropdown(event: Event): void {
    event.stopPropagation();
    this.isEditStatusDropdownOpen = !this.isEditStatusDropdownOpen;
    this.isEditReasonDropdownOpen = false;
    this.isEditSeverityDropdownOpen = false;
  }

  updateReportReason(reason: string, event: Event): void {
    event.stopPropagation();
    if (this.reporteSeleccionado) {
      this.reporteSeleccionado.reason = reason;
    }
    this.isEditReasonDropdownOpen = false;
  }

  updateReportSeverity(severity: string, event: Event): void {
    event.stopPropagation();
    if (this.reporteSeleccionado) {
      this.reporteSeleccionado.severity = severity;
    }
    this.isEditSeverityDropdownOpen = false;
  }

  updateReportStatus(status: string, event: Event): void {
    event.stopPropagation();
    if (this.reporteSeleccionado) {
      this.reporteSeleccionado.status = status;
    }
    this.isEditStatusDropdownOpen = false;
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case '': return 'Estado';
      case 'all': return 'Todos';
      case 'pendiente': return 'Pendiente';
      case 'en-revision': return 'En revisión';
      case 'resuelto': return 'Resuelto';
      case 'rechazado': return 'Rechazado';
      default: return status;
    }
  }

  // ========================================
  // FILTROS Y BÚSQUEDA
  // ========================================

  applyFilters(): void {
    console.log('Aplicando filtros:', {
      searchTerm: this.searchTerm,
      filterReason: this.filterReason,
      filterSeverity: this.filterSeverity,
      filterStatus: this.filterStatus,
      filterDate: this.filterDate
    });

    this.filteredReports = this.allReports.filter(report => {
      // Filtrar por término de búsqueda (ID, usuario, motivo, gravedad, estado)
      if (this.searchTerm) {
        const searchLower = this.searchTerm.toLowerCase();
        const matchesSearch =
          report.id.toLowerCase().includes(searchLower) ||
          report.userName.toLowerCase().includes(searchLower) ||
          report.userEmail.toLowerCase().includes(searchLower) ||
          report.reason.toLowerCase().includes(searchLower) ||
          report.severity.toLowerCase().includes(searchLower) ||
          report.status.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Filtrar por motivo
      if (this.filterReason && this.filterReason !== 'all') {
        const reasonMap: { [key: string]: string } = {
          'spam': 'Spam',
          'acoso': 'Acoso',
          'contenido-inapropiado': 'Contenido inapropiado',
          'discurso-odio': 'Discurso de odio',
          'falsificacion': 'Falsificación'
        };
        if (report.reason !== reasonMap[this.filterReason]) return false;
      }

      // Filtrar por gravedad
      if (this.filterSeverity && this.filterSeverity !== 'all') {
        const severityMap: { [key: string]: string } = {
          'baja': 'Baja',
          'media': 'Media',
          'alta': 'Alta',
          'critica': 'Crítica'
        };
        if (report.severity !== severityMap[this.filterSeverity]) return false;
      }

      // Filtrar por estado
      if (this.filterStatus && this.filterStatus !== 'all') {
        const statusMap: { [key: string]: string } = {
          'pendiente': 'Pendiente',
          'en-revision': 'En revisión',
          'resuelto': 'Resuelto',
          'rechazado': 'Rechazado'
        };
        if (report.status !== statusMap[this.filterStatus]) return false;
      }

      // Filtrar por fecha
      if (this.filterDate) {
        const filterDate = new Date(this.filterDate);
        const reportDate = new Date(report.date);
        if (reportDate.toDateString() !== filterDate.toDateString()) return false;
      }

      return true;
    });

    // Actualizar reportes visibles con paginación
    this.totalItems = this.filteredReports.length;
    this.totalPages = Math.ceil(this.filteredReports.length / this.itemsPerPage);
    this.currentPage = 1; // Resetear a primera página
    this.updatePaginatedReports();

    console.log('Reportes filtrados:', this.filteredReports.length);
  }

  updatePaginatedReports(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.reports = this.filteredReports.slice(startIndex, endIndex);
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.filterReason = '';
    this.filterSeverity = '';
    this.filterStatus = '';
    this.filterDate = '';
    this.applyFilters();
    console.log('Filtros limpiados');
  }

  // ========================================
  // ACCIONES DE REPORTES
  // ========================================

  abrirModalAgregarReporte(): void {
    this.nuevoReporte = {
      userName: '',
      userEmail: '',
      reason: '',
      severity: '',
      date: new Date().toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      status: 'Pendiente',
      description: ''
    };
    this.mostrarModalAgregar = true;
  }

  cerrarModalAgregar(): void {
    this.mostrarModalAgregar = false;
    this.nuevoReporte = null;
  }

  guardarNuevoReporte(): void {
    if (this.nuevoReporte && this.nuevoReporte.userName && this.nuevoReporte.userEmail && this.nuevoReporte.reason && this.nuevoReporte.severity && this.nuevoReporte.description) {
      const reporteSinId: Omit<Report, 'id'> = {
        userName: this.nuevoReporte.userName,
        userEmail: this.nuevoReporte.userEmail,
        reason: this.nuevoReporte.reason,
        severity: this.nuevoReporte.severity,
        date: this.nuevoReporte.date || new Date().toLocaleString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        status: this.nuevoReporte.status || 'Pendiente',
        description: this.nuevoReporte.description
      };

      this.moderatorService.create(reporteSinId).subscribe(() => {
        this.loadReports();
        this.cerrarModalAgregar();
        console.log('Reporte agregado exitosamente');
      });
    }
  }

  verReporte(reportId: string): void {
    console.log('Ver reporte:', reportId);
    this.reporteSeleccionado = this.reports.find(r => r.id === reportId) || null;
    if (this.reporteSeleccionado) {
      this.mostrarModalVer = true;
    }
  }

  cerrarModalVer(): void {
    this.mostrarModalVer = false;
    this.reporteSeleccionado = null;
  }

  abrirModalEditar(reportId: string): void {
    console.log('Abrir modal editar:', reportId);
    this.reporteSeleccionado = this.reports.find(r => r.id === reportId) || null;
    if (this.reporteSeleccionado) {
      this.mostrarModalEditar = true;
    }
  }

  cerrarModalEditar(): void {
    this.mostrarModalEditar = false;
    this.reporteSeleccionado = null;
  }

  actualizarReporte(): void {
    if (this.reporteSeleccionado) {
      console.log('Actualizando reporte:', this.reporteSeleccionado.id);
      this.moderatorService.update(this.reporteSeleccionado.id, this.reporteSeleccionado).subscribe(() => {
        const index = this.allReports.findIndex(r => r.id === this.reporteSeleccionado!.id);
        if (index !== -1 && this.reporteSeleccionado) {
          this.allReports[index] = this.reporteSeleccionado;
          this.calculateStats();
          this.applyFilters();
        }
        this.cerrarModalEditar();
      });
    }
  }

  viewReport(reportId: string): void {
    this.verReporte(reportId);
  }

  approveReport(reportId: string): void {
    console.log('Aprobar reporte:', reportId);
    const report = this.allReports.find(r => r.id === reportId);
    if (report) {
      report.status = 'Resuelto';
      this.moderatorService.update(reportId, report).subscribe(() => {
        this.calculateStats();
        this.applyFilters();
        console.log('Reporte aprobado:', reportId);
      });
    }
  }

  deleteReport(reportId: string): void {
    console.log('Eliminar reporte:', reportId);
    if (confirm('¿Estás seguro de que deseas eliminar este reporte?')) {
      this.moderatorService.delete(reportId).subscribe(() => {
        this.allReports = this.allReports.filter(r => r.id !== reportId);
        this.calculateStats();
        this.applyFilters();
        console.log('Reporte eliminado:', reportId);
      });
    }
  }

  // ========================================
  // HELPERS PARA CLASES CSS
  // ========================================

  formatUserNameForAvatar(userName: string): string {
    return userName.replace(/ /g, '+');
  }

  getMinValue(a: number, b: number): number {
    return Math.min(a, b);
  }

  getSeverityClass(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'baja': return 'low';
      case 'media': return 'medium';
      case 'alta': return 'high';
      case 'crítica': return 'critical';
      default: return 'low';
    }
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'pendiente': return 'pending';
      case 'en revisión': return 'in-review';
      case 'resuelto': return 'resolved';
      case 'rechazado': return 'rejected';
      default: return 'pending';
    }
  }

  getReasonClass(reason: string): string {
    switch (reason.toLowerCase()) {
      case 'spam': return 'orange';
      case 'acoso': return 'red';
      case 'contenido inapropiado': return 'blue';
      case 'discurso de odio': return 'purple';
      case 'falsificación': return 'green';
      default: return 'red';
    }
  }

  // ========================================
  // PAGINACIÓN
  // ========================================

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedReports();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedReports();
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedReports();
    }
  }
}
