import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, takeUntil } from 'rxjs';
import { Evidence, EvidenceFilters, EvidenceStats } from '../../../core/models/evidence.model';
import { EvidenceService } from '../../../core/services/evidence.service';
import { compactPages } from '../../../shared/utils/pagination';

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
  private cdr = inject(ChangeDetectorRef);

  // Datos
  evidences$: Observable<Evidence[]> = this.evidenceService.evidences$;
  stats$: Observable<EvidenceStats> = this.evidenceService.getStats();
  
  filteredEvidences: Evidence[] = [];
  stats: EvidenceStats = {
    totalEvidenceCount: 0,
    verified: 0,
    pending: 0,
    rejected: 0,
    downloads: 0
  };

  // Filtros
  filters: EvidenceFilters = {
    search: '',
    type: '',
    status: '',
    startDate: null,
    endDate: null
  };

  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 6;
  totalPages: number = 0;

  // Estados UI
  loading = false;
  error = '';
  selectedEvidence: Evidence | null = null;
  showViewModal = false;
  
  // Estados de dropdowns personalizados
  isEvidenceTypeDropdownOpen = false;
  isStatusDropdownOpen = false;
  
  // Handler to close dropdowns when clicking outside
  private clickHandler: (() => void) | null = null;

  // For search
  searchTermEvidence: string = '';
  filterEvidenceType: string = 'all';
  filterStatus: string = 'all';

  constructor() {
    // Close dropdowns when clicking outside them
    this.clickHandler = () => {
      this.isEvidenceTypeDropdownOpen = false;
      this.isStatusDropdownOpen = false;
    };
    document.addEventListener('click', this.clickHandler);
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Remove the click listener to avoid memory leaks
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler);
    }
  }

  // ========================================
  // CARGA DE DATOS
  // ========================================

  private loadData(): void {
    this.loading = true;
    
    this.evidenceService.getAll().pipe(takeUntil(this.destroy$)).subscribe({
      next: (evidences) => {
        this.filteredEvidences = evidences;
        this.updatePagination();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Error al cargar las evidencias';
        this.loading = false;
        console.error('Error cargando evidencias:', err);
        this.cdr.detectChanges();
      }
    });

    this.stats$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (stats) => {
        this.stats = stats;
        this.cdr.detectChanges();
      }
    });
  }

  // ========================================
  // FILTRADO
  // ========================================

  applyFilters(): void {
    this.loading = true;
    this.currentPage = 1; // Reset to the first page

    const filters: EvidenceFilters = {
      search: this.searchTermEvidence,
      type: this.filterEvidenceType,
      status: this.filterStatus,
      startDate: null,
      endDate: null
    };


    this.evidenceService.filterEvidences(filters).pipe(takeUntil(this.destroy$)).subscribe({
      next: (evidences) => {
        this.filteredEvidences = evidences;
        this.updatePagination();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Error al filtrar evidencias';
        this.loading = false;
        console.error('Error filtrando:', err);
      }
    });
  }

  clearFilters(): void {
    this.searchTermEvidence = '';
    this.filterEvidenceType = 'all';
    this.filterStatus = 'all';
    this.loadData();
  }

  // ========================================
  // PAGINACIÓN
  // ========================================

  private updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredEvidences.length / this.itemsPerPage);
  }

  get paginatedEvidences(): Evidence[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredEvidences.slice(startIndex, startIndex + this.itemsPerPage);
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

  getPagesArray(): (number | null)[] {
    return compactPages(this.currentPage, this.totalPages);
  }

  // ========================================
  // ACCIONES CRUD
  // ========================================

  viewEvidence(evidence: Evidence): void {
    this.selectedEvidence = evidence;
    this.showViewModal = true;
  }

  downloadEvidence(id: number): void {
    this.loading = true;
    this.evidenceService.download(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (blob) => {
        const evidence = this.selectedEvidence || this.filteredEvidences.find(e => e.id === id);
        const fileName = evidence?.name || `evidencia_${id}`;
        this.downloadFile(blob, fileName);
        // The stats are updated automatically in the service
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Error al descargar evidencia';
        this.loading = false;
        this.cdr.detectChanges();
        console.error('Error descargando:', err);
      }
    });
  }

  deleteEvidence(id: number): void {
    if (confirm('¿Estás seguro de eliminar esta evidencia?')) {
      this.loading = true;
      this.evidenceService.delete(id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          // Reload data to update the table and the stats
          this.loadData();
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Error al eliminar evidencia';
          this.loading = false;
          this.cdr.detectChanges();
          console.error('Error eliminando:', err);
        }
      });
    }
  }

  changeEvidenceStatus(id: number, newStatus: 'Verificada' | 'Pendiente' | 'Rechazada'): void {
    this.loading = true;
    this.evidenceService.changeStatus(id, newStatus).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updatedEvidence) => {
        // Update the selected evidence in the modal
        if (this.selectedEvidence && this.selectedEvidence.id === id) {
          this.selectedEvidence = updatedEvidence;
        }
        // Reload data to update the table and the stats
        this.loadData();
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al cambiar estado';
        this.loading = false;
        this.cdr.detectChanges();
        console.error('Error cambiando estado:', err);
      }
    });
  }

  /** Downloads the real file. If it arrives empty it is no longer on the server: the user is told, nothing is made up. */
  private downloadFile(blob: Blob, name: string): void {
    if (blob.size === 0) {
      this.error = 'El archivo de esta evidencia está vacío o ya no existe en el servidor.';
      return;
    }
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
  // MODALES
  // ========================================

  closeViewModal(): void {
    this.showViewModal = false;
    this.selectedEvidence = null;
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

  selectEvidenceType(type: string, event: Event): void {
    event.stopPropagation();
    this.filterEvidenceType = type;
    this.isEvidenceTypeDropdownOpen = false;
    // Do not apply filters automatically, wait for the Search button
  }

  selectStatus(status: string, event: Event): void {
    event.stopPropagation();
    this.filterStatus = status;
    this.isStatusDropdownOpen = false;
    // Do not apply filters automatically, wait for the Search button
  }

  getEvidenceTypeLabel(type: string): string {
    switch (type) {
      case 'all': return 'Todos los tipos';
      case 'foto': return 'Imagen';
      case 'video': return 'Video';
      case 'audio': return 'Audio';
      case 'documento': return 'Documento';
      default: return type;
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'all': return 'Todos los estados';
      case 'Verificada': return 'Verificada';
      case 'Pendiente': return 'Pendiente';
      case 'Rechazada': return 'Rechazada';
      default: return status;
    }
  }

  // ========================================
  // UTILIDADES
  // ========================================

  getEvidenceTypeBadgeClass(type: string): string {
    switch (type) {
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

  getEvidenceStatusBadgeClass(status: string): string {
    switch (status) {
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

  getEvidenceTypeDisplay(type: string): string {
    switch (type) {
      case 'foto':
        return 'Imagen';
      case 'video':
        return 'Video';
      case 'audio':
        return 'Audio';
      case 'documento':
        return 'Documento';
      default:
        return type;
    }
  }

  /**
   * trackBy function to optimize the performance of Angular lists
   */
  trackByIndex(index: number): number {
    return index;
  }

  // Getters for template compatibility
  get totalEvidences(): number {
    return this.stats.totalEvidenceCount;
  }

  get verifiedEvidences(): number {
    return this.stats.verified;
  }

  get pendingEvidences(): number {
    return this.stats.pending;
  }

  get rejectedEvidences(): number {
    return this.stats.rejected;
  }

  get totalDownloads(): number {
    return this.stats.downloads;
  }
}
