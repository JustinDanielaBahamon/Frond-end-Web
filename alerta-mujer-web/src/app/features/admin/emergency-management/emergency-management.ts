import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Interfaces para definir la estructura de datos
 */
interface EmergencyContact {
  id: number;
  name: string;
  relationship: string;
  phone: string;
  receivesAlerts: boolean;
  avatar: string;
}

interface User {
  id: number;
  avatar: string;
  name: string;
  city: string;
  email: string;
  phone: string;
  contactsCount: number;
  status: 'Activa' | 'Inactiva';
  emergencyContacts: EmergencyContact[];
}

@Component({
  selector: 'app-emergency-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './emergency-management.html',
  styleUrls: ['./emergency-management.scss']
})
export class EmergencyManagementComponent implements OnInit {

  // Propiedades para la visualización de datos
  users: User[] = [];
  filteredUsers: User[] = [];
  selectedUser: User | null = null;
  showDrawer: boolean = false;

  // Propiedades para filtros y paginación
  searchTerm: string = '';
  filterCity: string = 'all';
  filterStatus: string = 'all';
  currentPage: number = 1;
  itemsPerPage: number = 6;
  totalPages: number = 0;

  // Estadísticas calculadas
  usersWithContacts: number = 0;
  totalContacts: number = 0;
  usersWithoutContacts: number = 0;
  avgContactsPerUser: string = '0.00';

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
    this.users = [
      {
        id: 1,
        avatar: 'assets/avatar-maria.png',
        name: 'María Fernanda López',
        city: 'Neiva',
        email: 'maria.lopez@gmail.com',
        phone: '311 245 6789',
        contactsCount: 3,
        status: 'Activa',
        emergencyContacts: [
          { id: 101, name: 'Carlos López', relationship: 'Padre', phone: '311 245 6789', receivesAlerts: true, avatar: 'assets/avatar-carlos.png' },
          { id: 102, name: 'Laura López', relationship: 'Hermana', phone: '310 456 7890', receivesAlerts: true, avatar: 'assets/avatar-laura.png' },
          { id: 103, name: 'Daniela López', relationship: 'Amiga', phone: '312 789 4561', receivesAlerts: true, avatar: 'assets/avatar-daniela.png' },
        ]
      },
      {
        id: 2,
        avatar: 'assets/avatar-ana.png',
        name: 'Ana Sofía Ramírez',
        city: 'Bogotá',
        email: 'ana.ramirez@gmail.com',
        phone: '310 123 4567',
        contactsCount: 2,
        status: 'Activa',
        emergencyContacts: [
          { id: 201, name: 'Pedro Ramírez', relationship: 'Hermano', phone: '310 123 4567', receivesAlerts: true, avatar: 'assets/avatar-pedro.png' },
          { id: 202, name: 'Sofía Giraldo', relationship: 'Amiga', phone: '320 987 6543', receivesAlerts: false, avatar: 'assets/avatar-sofia.png' },
        ]
      },
      {
        id: 3,
        avatar: 'assets/avatar-valentina.png',
        name: 'Valentina Castro',
        city: 'Cali',
        email: 'valentina.castro@gmail.com',
        phone: '315 987 6543',
        contactsCount: 1,
        status: 'Activa',
        emergencyContacts: [
          { id: 301, name: 'Andrés Castro', relationship: 'Padre', phone: '315 987 6543', receivesAlerts: true, avatar: 'assets/avatar-andres.png' },
        ]
      },
      {
        id: 4,
        avatar: 'assets/avatar-isabella.png',
        name: 'Isabella Martínez',
        city: 'Medellín',
        email: 'isabella.martinez@gmail.com',
        phone: '300 654 3210',
        contactsCount: 2,
        status: 'Activa',
        emergencyContacts: [
          { id: 401, name: 'Ricardo Martínez', relationship: 'Hermano', phone: '300 654 3210', receivesAlerts: true, avatar: 'assets/avatar-ricardo.png' },
          { id: 402, name: 'Elena Gaviria', relationship: 'Madre', phone: '301 112 2334', receivesAlerts: true, avatar: 'assets/avatar-elena.png' },
        ]
      },
      {
        id: 5,
        avatar: 'assets/avatar-daniela-p.png',
        name: 'Daniela Paredes',
        city: 'Barranquilla',
        email: 'daniela.paredes@gmail.com',
        phone: '312 369 8521',
        contactsCount: 3,
        status: 'Activa',
        emergencyContacts: [
          { id: 501, name: 'Jorge Paredes', relationship: 'Padre', phone: '312 369 8521', receivesAlerts: true, avatar: 'assets/avatar-jorge.png' },
          { id: 502, name: 'Camila Soto', relationship: 'Amiga', phone: '300 555 4433', receivesAlerts: false, avatar: 'assets/avatar-camila.png' },
          { id: 503, name: 'Roberto Díaz', relationship: 'Tío', phone: '305 777 8899', receivesAlerts: true, avatar: 'assets/avatar-roberto.png' },
        ]
      },
      {
        id: 6,
        avatar: 'assets/avatar-sofia-h.png',
        name: 'Sofía Herrera',
        city: 'Neiva',
        email: 'sofia.herrera@gmail.com',
        phone: '311 753 9514',
        contactsCount: 1,
        status: 'Inactiva',
        emergencyContacts: [
          { id: 601, name: 'Martín Herrera', relationship: 'Hermano', phone: '311 753 9514', receivesAlerts: true, avatar: 'assets/avatar-martin.png' },
        ]
      },
    ];
  }

  /**
   * Calcula las estadísticas globales basadas en los usuarios cargados
   */
  calculateStats(): void {
    this.usersWithContacts = this.users.filter(user => user.contactsCount > 0).length;
    this.totalContacts = this.users.reduce((sum, user) => sum + user.emergencyContacts.length, 0);
    this.usersWithoutContacts = this.users.filter(user => user.contactsCount === 0).length;
    this.avgContactsPerUser = this.users.length > 0 
      ? (this.totalContacts / this.users.length).toFixed(2) 
      : '0.00';
  }

  /**
   * Abre el panel lateral (drawer) con la información de la usuaria seleccionada
   */
  openDrawer(user: User): void {
    this.selectedUser = user;
    this.showDrawer = true;
  }

  /**
   * Cierra el panel lateral
   */
  closeDrawer(): void {
    this.showDrawer = false;
    this.selectedUser = null;
  }

  /**
   * Aplica los filtros de búsqueda, ciudad y estado a la lista de usuarias
   */
  applyFilters(): void {
    let tempUsers = [...this.users];

    if (this.searchTerm) {
      const lowerCaseSearchTerm = this.searchTerm.toLowerCase();
      tempUsers = tempUsers.filter(user =>
        user.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        user.email.toLowerCase().includes(lowerCaseSearchTerm) ||
        user.phone.includes(lowerCaseSearchTerm)
      );
    }

    if (this.filterCity !== 'all') {
      tempUsers = tempUsers.filter(user => user.city === this.filterCity);
    }

    if (this.filterStatus !== 'all') {
      tempUsers = tempUsers.filter(user => user.status === this.filterStatus);
    }

    this.filteredUsers = tempUsers;
    this.currentPage = 1;
    this.updatePagination();
  }

  /**
   * Limpia todos los filtros aplicados
   */
  clearFilters(): void {
    this.searchTerm = '';
    this.filterCity = 'all';
    this.filterStatus = 'all';
    this.applyFilters();
  }

  /**
   * Obtiene la lista de usuarias paginada para la visualización actual
   */
  get paginatedUsers(): User[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredUsers.slice(startIndex, startIndex + this.itemsPerPage);
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredUsers.length / this.itemsPerPage);
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
   * Helper para asignar la clase CSS correcta al badge de relación
   */
  getRelationshipBadgeClass(relationship: string): string {
    switch (relationship.toLowerCase()) {
      case 'padre':
      case 'madre':
        return 'badge-purple';
      case 'hermano':
      case 'hermana':
        return 'badge-pink';
      case 'amiga':
      case 'amigo':
        return 'badge-blue';
      case 'tío':
      case 'tía':
        return 'badge-green';
      default:
        return 'badge-gray';
    }
  }

  /**
   * Helper para asignar la clase CSS correcta al badge de estado
   */
  getUserStatusBadgeClass(status: 'Activa' | 'Inactiva'): string {
    return status === 'Activa' ? 'status-active' : 'status-inactive';
  }

  /**
   * Función trackBy para optimizar el rendimiento de las listas de Angular
   */
  trackByIndex(index: number): number {
    return index;
  }

}
