import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeviceService, Device, DeviceStats } from '../../../core/services/device.service';
import { Observable, Subject } from 'rxjs';

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
  cargando = false;
  error = '';
  dispositivoSeleccionado: Device | null = null;
  mostrarModalVer = false;
  mostrarModalEditar = false;
  mostrarModalCrear = false;
  
  // Estados de dropdowns personalizados
  isStatusDropdownOpen = false;
  isTypeDropdownOpenCrear = false;
  isStatusDropdownOpenCrear = false;
  isTypeDropdownOpenEditar = false;
  isStatusDropdownOpenEditar = false;
  
  // Handler para cerrar dropdowns al hacer clic fuera
  private clickHandler: (() => void) | null = null;

  private destroy$ = new Subject<void>();

  constructor(private deviceService: DeviceService) {
    this.stats$ = this.deviceService.stats$;
    
    // Cerrar dropdowns al hacer clic fuera de ellos
    this.clickHandler = () => {
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
    
    this.deviceService.getAll().subscribe({
      next: (devices) => {
        this.devices = devices;
        this.filteredDevices = devices;
        this.updatePagination();
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'Error al cargar los dispositivos';
        this.cargando = false;
        console.error('Error cargando dispositivos:', err);
      }
    });

    this.stats$.subscribe({
      next: (stats) => {
        console.log('Estadísticas actualizadas:', stats);
        this.stats = stats;
      }
    });
  }

  /**
   * Aplica los filtros de búsqueda y estado a la lista
   */
  applyFilters(): void {
    this.cargando = true;
    this.currentPage = 1; // Resetear a primera página

    const filtros = {
      busqueda: this.searchTerm,
      estado: this.filterStatus,
      fechaInicio: null,
      fechaFin: null
    };

    this.deviceService.filtrarDispositivos(filtros).subscribe({
      next: (devices) => {
        this.filteredDevices = devices;
        this.updatePagination();
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'Error al filtrar dispositivos';
        this.cargando = false;
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

  getPagesArray(): number[] {
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  /**
   * Helper para asignar la clase CSS correcta al badge de estado del dispositivo
   */
  getDeviceStatusBadgeClass(status: 'Activo' | 'Inactivo' | 'Bloqueado'): string {
    switch (status) {
      case 'Activo':
        return 'status-active';
      case 'Inactivo':
        return 'status-inactive';
      case 'Bloqueado':
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
  verDispositivo(id: number): void {
    console.log('verDispositivo llamado con ID:', id);
    this.deviceService.getById(id).subscribe({
      next: (device) => {
        console.log('Dispositivo cargado:', device);
        this.dispositivoSeleccionado = device;
        this.mostrarModalVer = true;
        console.log('Modal ver debería mostrarse');
      },
      error: (err) => {
        this.error = 'Error al cargar el dispositivo';
        console.error('Error cargando dispositivo:', err);
      }
    });
  }

  /**
   * Abrir modal para crear un nuevo dispositivo
   */
  abrirModalCrear(): void {
    console.log('abrirModalCrear llamado');
    this.dispositivoSeleccionado = {
      id: 0,
      name: '',
      osVersion: '',
      user: { name: '', email: '' },
      type: 'Android',
      imei: '',
      phone: '',
      status: 'Activo',
      lastSync: '',
      icon: 'fa-brands fa-android'
    };
    this.mostrarModalCrear = true;
    console.log('Modal crear debería mostrarse');
  }

  /**
   * Crear un nuevo dispositivo
   */
  crearDispositivo(device: Omit<Device, 'id'>): void {
    this.cargando = true;
    this.deviceService.create(device).subscribe({
      next: (nuevoDevice) => {
        this.cargarDatos();
        this.mostrarModalCrear = false;
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'Error al crear dispositivo';
        this.cargando = false;
        console.error('Error creando dispositivo:', err);
      }
    });
  }

  /**
   * Abrir modal para editar un dispositivo
   */
  abrirModalEditar(id: number): void {
    console.log('abrirModalEditar llamado con ID:', id);
    this.deviceService.getById(id).subscribe({
      next: (device) => {
        console.log('Dispositivo cargado para editar:', device);
        this.dispositivoSeleccionado = device;
        this.mostrarModalEditar = true;
        console.log('Modal editar debería mostrarse');
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
  actualizarDispositivo(device: Device): void {
    this.cargando = true;
    this.deviceService.update(device.id, device).subscribe({
      next: () => {
        this.cargarDatos();
        this.mostrarModalEditar = false;
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'Error al actualizar dispositivo';
        this.cargando = false;
        console.error('Error actualizando dispositivo:', err);
      }
    });
  }

  /**
   * Eliminar un dispositivo
   */
  eliminarDispositivo(id: number): void {
    if (confirm('¿Estás seguro de eliminar este dispositivo?')) {
      this.cargando = true;
      this.deviceService.delete(id).subscribe({
        next: () => {
          this.cargarDatos();
          this.cargando = false;
        },
        error: (err) => {
          this.error = 'Error al eliminar dispositivo';
          this.cargando = false;
          console.error('Error eliminando dispositivo:', err);
        }
      });
    }
  }

  /**
   * Cambiar estado de un dispositivo
   */
  cambiarEstadoDispositivo(id: number, nuevoEstado: 'Activo' | 'Inactivo' | 'Bloqueado'): void {
    this.cargando = true;
    this.deviceService.cambiarEstado(id, nuevoEstado).subscribe({
      next: () => {
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

  // ========================================
  // MODALES
  // ========================================

  cerrarModalVer(): void {
    this.mostrarModalVer = false;
    this.dispositivoSeleccionado = null;
  }

  cerrarModalEditar(): void {
    this.mostrarModalEditar = false;
    this.dispositivoSeleccionado = null;
  }

  cerrarModalCrear(): void {
    this.mostrarModalCrear = false;
    this.dispositivoSeleccionado = null;
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
    console.log('Seleccionado estado:', estado);
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

  // Dropdowns para modal crear
  toggleTypeDropdownCrear(event: Event): void {
    event.stopPropagation();
    this.isTypeDropdownOpenCrear = !this.isTypeDropdownOpenCrear;
  }

  selectTypeCrear(tipo: string, event: Event): void {
    event.stopPropagation();
    if (this.dispositivoSeleccionado) {
      this.dispositivoSeleccionado.type = tipo as 'Android';
    }
    this.isTypeDropdownOpenCrear = false;
  }

  toggleStatusDropdownCrear(event: Event): void {
    event.stopPropagation();
    this.isStatusDropdownOpenCrear = !this.isStatusDropdownOpenCrear;
  }

  selectStatusCrear(estado: string, event: Event): void {
    event.stopPropagation();
    if (this.dispositivoSeleccionado) {
      this.dispositivoSeleccionado.status = estado as 'Activo' | 'Inactivo' | 'Bloqueado';
    }
    this.isStatusDropdownOpenCrear = false;
  }

  // Dropdowns para modal editar
  toggleTypeDropdownEditar(event: Event): void {
    event.stopPropagation();
    this.isTypeDropdownOpenEditar = !this.isTypeDropdownOpenEditar;
  }

  selectTypeEditar(tipo: string, event: Event): void {
    event.stopPropagation();
    if (this.dispositivoSeleccionado) {
      this.dispositivoSeleccionado.type = tipo as 'Android';
    }
    this.isTypeDropdownOpenEditar = false;
  }

  toggleStatusDropdownEditar(event: Event): void {
    event.stopPropagation();
    this.isStatusDropdownOpenEditar = !this.isStatusDropdownOpenEditar;
  }

  selectStatusEditar(estado: string, event: Event): void {
    event.stopPropagation();
    if (this.dispositivoSeleccionado) {
      this.dispositivoSeleccionado.status = estado as 'Activo' | 'Inactivo' | 'Bloqueado';
    }
    this.isStatusDropdownOpenEditar = false;
  }

}
