import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Interfaces para definir la estructura de datos
 */
interface Device {
  id: number;
  name: string;
  osVersion: string;
  user: {
    name: string;
    email: string;
  };
  type: 'Android' | 'iOS';
  imei: string;
  phone: string;
  status: 'Activo' | 'Inactivo' | 'Bloqueado';
  lastSync: string;
  icon: string;
}

@Component({
  selector: 'app-device-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './devices-management.html',
  styleUrls: ['./devices-management.scss']
})
export class DeviceManagementComponent implements OnInit {

  // Propiedades para la visualización de datos
  devices: Device[] = [];
  filteredDevices: Device[] = [];

  // Propiedades para filtros y paginación
  searchTerm: string = '';
  filterUser: string = 'all'; // Para filtrar por usuario (nombre o email)
  filterStatus: string = 'all';
  filterDeviceType: string = 'all';
  currentPage: number = 1;
  itemsPerPage: number = 6;
  totalPages: number = 0;

  // Estadísticas
  totalDevices: number = 0;
  activeDevices: number = 0;
  inactiveDevices: number = 0;
  blockedDevices: number = 0;
  syncedToday: number = 0;

  constructor() { }

  ngOnInit(): void {
    this.loadMockData();
    this.applyFilters();
    this.calculateStats();
  }

  /**
   * Carga de datos simulados para la visualización inicial
   */
  loadMockData(): void {
    this.devices = [
      {
        id: 1,
        name: 'Samsung Galaxy A54',
        osVersion: 'Android 13',
        user: { name: 'María Fernanda López', email: 'maria.lopez@gmail.com' },
        type: 'Android',
        imei: '354684123456789',
        phone: '311 245 6789',
        status: 'Activo',
        lastSync: 'Hoy, 10:24 a.m.',
        icon: 'fa-brands fa-android'
      },
      {
        id: 2,
        name: 'iPhone 13',
        osVersion: 'iOS 16.6',
        user: { name: 'Ana Sofía Ramírez', email: 'ana.ramirez@gmail.com' },
        type: 'iOS',
        imei: '356789123456789',
        phone: '310 123 4567',
        status: 'Activo',
        lastSync: 'Hoy, 09:15 a.m.',
        icon: 'fa-brands fa-apple'
      },
      {
        id: 3,
        name: 'Xiaomi Redmi Note 12',
        osVersion: 'Android 12',
        user: { name: 'Valentina Castro', email: 'valentina.castro@gmail.com' },
        type: 'Android',
        imei: '862341567890123',
        phone: '315 987 6543',
        status: 'Inactivo',
        lastSync: 'Ayer, 08:45 p.m.',
        icon: 'fa-brands fa-android'
      },
      {
        id: 4,
        name: 'Motorola G60',
        osVersion: 'Android 11',
        user: { name: 'Isabella Martínez', email: 'isabella.martinez@gmail.com' },
        type: 'Android',
        imei: '355678123456789',
        phone: '300 654 3210',
        status: 'Activo',
        lastSync: 'Hoy, 08:30 a.m.',
        icon: 'fa-brands fa-android'
      },
      {
        id: 5,
        name: 'iPhone 11',
        osVersion: 'iOS 15.4',
        user: { name: 'Daniela Paredes', email: 'daniela.paredes@gmail.com' },
        type: 'iOS',
        imei: '353456789012345',
        phone: '312 369 8521',
        status: 'Bloqueado',
        lastSync: 'Hace 3 días',
        icon: 'fa-brands fa-apple'
      },
      {
        id: 6,
        name: 'Samsung Galaxy S22',
        osVersion: 'Android 13',
        user: { name: 'Sofía Herrera', email: 'sofia.herrera@gmail.com' },
        type: 'Android',
        imei: '352147896325987',
        phone: '311 753 9514',
        status: 'Activo',
        lastSync: 'Hoy, 11:05 a.m.',
        icon: 'fa-brands fa-android'
      },
      {
        id: 7,
        name: 'Huawei P30 Pro',
        osVersion: 'Android 10',
        user: { name: 'Gabriela Rojas', email: 'gabriela.rojas@gmail.com' },
        type: 'Android',
        imei: '861234567890123',
        phone: '318 123 4567',
        status: 'Inactivo',
        lastSync: 'Hace 1 semana',
        icon: 'fa-brands fa-android'
      },
      {
        id: 8,
        name: 'iPhone SE',
        osVersion: 'iOS 17.0',
        user: { name: 'Luisa Fernanda Díaz', email: 'luisa.diaz@gmail.com' },
        type: 'iOS',
        imei: '359876543210987',
        phone: '304 987 6543',
        status: 'Activo',
        lastSync: 'Hoy, 09:00 a.m.',
        icon: 'fa-brands fa-apple'
      },
    ];
  }

  /**
   * Calcula las estadísticas globales basadas en los dispositivos cargados
   */
  calculateStats(): void {
    this.totalDevices = this.devices.length;
    this.activeDevices = this.devices.filter(device => device.status === 'Activo').length;
    this.inactiveDevices = this.devices.filter(device => device.status === 'Inactivo').length;
    this.blockedDevices = this.devices.filter(device => device.status === 'Bloqueado').length;
    // Simulación de sincronizados hoy
    this.syncedToday = this.devices.filter(device => device.lastSync.includes('Hoy')).length;
  }

  /**
   * Aplica los filtros de búsqueda, usuario, estado y tipo de dispositivo a la lista
   */
  applyFilters(): void {
    let tempDevices = [...this.devices];

    // Filtrar por término de búsqueda (ID, nombre, IMEI o teléfono)
    if (this.searchTerm) {
      const lowerCaseSearchTerm = this.searchTerm.toLowerCase();
      tempDevices = tempDevices.filter(device =>
        device.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        device.imei.includes(lowerCaseSearchTerm) ||
        device.phone.includes(lowerCaseSearchTerm)
      );
    }

    // Filtrar por usuario (nombre o email)
    if (this.filterUser !== 'all') {
      const lowerCaseFilterUser = this.filterUser.toLowerCase();
      tempDevices = tempDevices.filter(device =>
        device.user.name.toLowerCase().includes(lowerCaseFilterUser) ||
        device.user.email.toLowerCase().includes(lowerCaseFilterUser)
      );
    }

    // Filtrar por estado
    if (this.filterStatus !== 'all') {
      tempDevices = tempDevices.filter(device => device.status === this.filterStatus);
    }

    // Filtrar por tipo de dispositivo
    if (this.filterDeviceType !== 'all') {
      tempDevices = tempDevices.filter(device => device.type === this.filterDeviceType);
    }

    this.filteredDevices = tempDevices;
    this.currentPage = 1; // Reset pagination on filter change
    this.updatePagination();
  }

  /**
   * Limpia todos los filtros aplicados
   */
  clearFilters(): void {
    this.searchTerm = '';
    this.filterUser = 'all';
    this.filterStatus = 'all';
    this.filterDeviceType = 'all';
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
  getDeviceTypeBadgeClass(type: 'Android' | 'iOS'): string {
    return type === 'Android' ? 'badge-android' : 'badge-ios';
  }

  /**
   * Función trackBy para optimizar el rendimiento de las listas de Angular
   */
  trackByIndex(index: number): number {
    return index;
  }

}
