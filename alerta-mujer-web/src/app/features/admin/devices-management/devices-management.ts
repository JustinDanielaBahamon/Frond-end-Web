import { ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeviceService, Device, DeviceStats, DevicePermission } from '../../../core/services/device.service';
import { Observable, Subject } from 'rxjs';
import { compactPages } from '../../../shared/utils/paginacion';

@Component({
  selector: 'app-device-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './devices-management.html',
  styleUrls: ['./devices-management.scss']
})
export class DeviceManagementComponent implements OnInit, OnDestroy {

  // Propiedades para la visualización de datos
  devices: Device[] = [];
  filteredDevices: Device[] = [];

  // Propiedades para filtros y paginación
  searchTerm: string = '';
  filterStatus: string = 'all';
  currentPage: number = 1;
  itemsPerPage: number = 6;
  totalPages: number = 0;

  // Estadísticas
  stats$: Observable<DeviceStats>;
  stats: DeviceStats = {
    totalDevices: 0,
    activeDevices: 0,
    inactiveDevices: 0,
    blockedDevices: 0,
    syncedToday: 0
  };

  // Estados UI
  loading = false;
  error = '';
  selectedDevice: Device | null = null;
  showViewModal = false;
  showEditModal = false;
  
  // Estados de dropdowns personalizados
  isStatusDropdownOpen = false;
  isEditTypeDropdownOpen = false;
  isEditStatusDropdownOpen = false;
  
  // Handler para cerrar dropdowns al hacer clic fuera
  private clickHandler: (() => void) | null = null;

  private destroy$ = new Subject<void>();

  constructor(private deviceService: DeviceService, private cdr: ChangeDetectorRef) {
    this.stats$ = this.deviceService.stats$;
    
    // Cerrar dropdowns al hacer clic fuera de ellos
    this.clickHandler = () => {
      this.isStatusDropdownOpen = false;
    };
    document.addEventListener('click', this.clickHandler);
  }

  ngOnInit(): void {
    this.loadData();
  }

  permissionsReady(permissions: DevicePermission[]): number {
    return permissions.filter((p) => p.ready).length;
  }

  gpsText(estado?: string | null): string {
    // Valores de identity.device.gps_status
    const texts: Record<string, string> = {
      active: 'Encendido', inactive: 'Apagado', denied: 'Sin permiso', unknown: 'Desconocido',
    };
    return estado ? texts[estado] ?? estado : 'Sin informar';
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

  private loadData(): void {
    this.loading = true;
    
    this.deviceService.getAll().subscribe({
      next: (devices) => {
        this.devices = devices;
        this.filteredDevices = devices;
        this.updatePagination();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Error al cargar los dispositivos';
        this.loading = false;
        console.error('Error cargando dispositivos:', err);
        this.cdr.detectChanges();
      }
    });

    this.stats$.subscribe({
      next: (stats) => {
        this.stats = stats;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Aplica los filtros de búsqueda y estado a la lista
   */
  applyFilters(): void {
    this.loading = true;
    this.currentPage = 1; // Resetear a primera página

    const filters = {
      search: this.searchTerm,
      estado: this.filterStatus,
      startDate: null,
      endDate: null
    };

    this.deviceService.filterDevices(filters).subscribe({
      next: (devices) => {
        this.filteredDevices = devices;
        this.updatePagination();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Error al filtrar dispositivos';
        this.loading = false;
        console.error('Error filtrando:', err);
      }
    });
  }

  /**
   * Limpia todos los filtros aplicados
   */
  clearFilters(): void {
    this.searchTerm = '';
    this.filterStatus = 'all';
    this.applyFilters();
  }

  // Lógica de paginación
  get paginatedDevices(): Device[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredDevices.slice(startIndex, startIndex + this.itemsPerPage);
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredDevices.length / this.itemsPerPage);
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

  /**
   * Helper para asignar la clase CSS correcta al badge de estado del dispositivo
   */
  getDeviceStatusBadgeClass(status: Device['status']): string {
    switch (status) {
      case 'Activo':
        return 'status-active';
      case 'Inactivo':
        return 'status-inactive';
      case 'Bloqueado':
      case 'Perdido':
        return 'status-blocked';
      default:
        return '';
    }
  }

  /**
   * Helper para asignar la clase CSS correcta al badge de tipo de dispositivo
   */
  getDeviceTypeBadgeClass(type: 'Android'): string {
    return 'badge-android';
  }

  /**
   * Función trackBy para optimizar el rendimiento de las listas de Angular
   */
  trackByIndex(index: number): number {
    return index;
  }

  // ========================================
  // CRUD OPERATIONS
  // ========================================

  /**
   * Ver detalles de un dispositivo
   */
  viewDevice(id: number): void {
    this.deviceService.getById(id).subscribe({
      next: (device) => {
        this.selectedDevice = device;
        this.showViewModal = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Error al cargar el dispositivo';
        console.error('Error cargando dispositivo:', err);
      }
    });
  }

  /**
   * Abrir modal para editar un dispositivo
   */
  openEditModal(id: number): void {
    this.deviceService.getById(id).subscribe({
      next: (device) => {
        this.selectedDevice = device;
        this.showEditModal = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Error al cargar el dispositivo';
        console.error('Error cargando dispositivo:', err);
      }
    });
  }

  /**
   * Actualizar un dispositivo
   */
  updateDevice(device: Device): void {
    this.loading = true;
    this.deviceService.update(device.id, device).subscribe({
      next: () => {
        this.loadData();
        this.showEditModal = false;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al actualizar dispositivo';
        this.loading = false;
        this.cdr.detectChanges();
        console.error('Error actualizando dispositivo:', err);
      }
    });
  }

  /**
   * Eliminar un dispositivo
   */
  deleteDevice(id: number): void {
    if (confirm('¿Estás seguro de eliminar este dispositivo?')) {
      this.loading = true;
      this.deviceService.delete(id).subscribe({
        next: () => {
          this.loadData();
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Error al eliminar dispositivo';
          this.loading = false;
          this.cdr.detectChanges();
          console.error('Error eliminando dispositivo:', err);
        }
      });
    }
  }

  /**
   * Cambiar estado de un dispositivo
   */
  changeDeviceStatus(id: number, newStatus: Device['status']): void {
    this.loading = true;
    this.deviceService.changeStatus(id, newStatus).subscribe({
      next: () => {
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

  // ========================================
  // MODALES
  // ========================================

  closeViewModal(): void {
    this.showViewModal = false;
    this.selectedDevice = null;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedDevice = null;
  }

  // ========================================
  // DROPDOWN PERSONALIZADO
  // ========================================

  toggleStatusDropdown(event: Event): void {
    event.stopPropagation();
    this.isStatusDropdownOpen = !this.isStatusDropdownOpen;
  }

  selectStatus(estado: string, event: Event): void {
    event.stopPropagation();
    this.filterStatus = estado;
    this.isStatusDropdownOpen = false;
    this.applyFilters();
  }

  getStatusLabel(estado: string): string {
    switch (estado) {
      case 'all': return 'Todos los estados';
      case 'Activo': return 'Activo';
      case 'Inactivo': return 'Inactivo';
      case 'Bloqueado': return 'Bloqueado';
      default: return estado;
    }
  }

  // Dropdowns para modal editar
  toggleEditTypeDropdown(event: Event): void {
    event.stopPropagation();
    this.isEditTypeDropdownOpen = !this.isEditTypeDropdownOpen;
  }

  selectEditType(tipo: string, event: Event): void {
    event.stopPropagation();
    if (this.selectedDevice) {
      this.selectedDevice.type = tipo as 'Android';
    }
    this.isEditTypeDropdownOpen = false;
  }

  toggleEditStatusDropdown(event: Event): void {
    event.stopPropagation();
    this.isEditStatusDropdownOpen = !this.isEditStatusDropdownOpen;
  }

  selectEditStatus(estado: string, event: Event): void {
    event.stopPropagation();
    if (this.selectedDevice) {
      this.selectedDevice.status = estado as Device['status'];
    }
    this.isEditStatusDropdownOpen = false;
  }

}
