import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Interfaces para definir la estructura de datos
 */
interface Evidence {
  id: number;
  preview: string; // URL de la imagen de previsualización o icono
  name: string;
  evidenceId: string;
  size: string;
  user: {
    name: string;
    email: string;
  };
  alertRelated: {
    id: string;
    type: string;
    city: string;
  };
  type: 'Imagen' | 'Video' | 'Audio' | 'Documento';
  date: string;
  time: string;
  status: 'Verificada' | 'Pendiente' | 'Rechazada';
}

@Component({
  selector: 'app-evidences-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './evidence-management.html',
  styleUrls: ['./evidence-management.scss']
})
export class EvidencesManagementComponent implements OnInit {

  // Propiedades para la visualización de datos
  evidences: Evidence[] = [];
  filteredEvidences: Evidence[] = [];

  // Propiedades para filtros y paginación
  searchTermEvidence: string = '';
  searchTermUser: string = '';
  filterEvidenceType: string = 'all';
  filterStatus: string = 'all';
  filterDateRange: string = ''; // Podría ser un objeto de rango de fechas en una implementación real
  currentPage: number = 1;
  itemsPerPage: number = 6;
  totalPages: number = 0;

  // Estadísticas
  totalEvidences: number = 0;
  verifiedEvidences: number = 0;
  pendingEvidences: number = 0;
  rejectedEvidences: number = 0;
  totalDownloads: number = 0;

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
    this.evidences = [
      {
        id: 1,
        preview: 'assets/evidence-img-1.png',
        name: 'IMG_20240512_092301.jpg',
        evidenceId: 'EV-2024-0001',
        size: '2.4 MB',
        user: { name: 'María Fernanda López', email: 'maria.lopez@gmail.com' },
        alertRelated: { id: 'AL-2024-0456', type: 'SOS', city: 'Neiva' },
        type: 'Imagen',
        date: '12/05/2024',
        time: '09:23 a.m.',
        status: 'Verificada',
      },
      {
        id: 2,
        preview: 'assets/evidence-vid-1.png',
        name: 'VID_20240511_214522.mp4',
        evidenceId: 'EV-2024-0002',
        size: '15.6 MB',
        user: { name: 'Ana Sofía Ramírez', email: 'ana.ramirez@gmail.com' },
        alertRelated: { id: 'AL-2024-0451', type: 'Acoso', city: 'Bogotá' },
        type: 'Video',
        date: '11/05/2024',
        time: '09:45 p.m.',
        status: 'Pendiente',
      },
      {
        id: 3,
        preview: 'assets/evidence-aud-1.png',
        name: 'AUD_20240510_185500.m4a',
        evidenceId: 'EV-2024-0003',
        size: '3.2 MB',
        user: { name: 'Valentina Castro', email: 'valentina.castro@gmail.com' },
        alertRelated: { id: 'AL-2024-0448', type: 'Robo', city: 'Cali' },
        type: 'Audio',
        date: '10/05/2024',
        time: '06:55 p.m.',
        status: 'Verificada',
      },
      {
        id: 4,
        preview: 'assets/evidence-doc-1.png',
        name: 'DOC_20240510_163012.pdf',
        evidenceId: 'EV-2024-0004',
        size: '1.1 MB',
        user: { name: 'Isabella Martínez', email: 'isabella.martinez@gmail.com' },
        alertRelated: { id: 'AL-2024-0443', type: 'SOS', city: 'Medellín' },
        type: 'Documento',
        date: '10/05/2024',
        time: '04:30 p.m.',
        status: 'Rechazada',
      },
      {
        id: 5,
        preview: 'assets/evidence-img-2.png',
        name: 'IMG_20240509_221045.jpg',
        evidenceId: 'EV-2024-0005',
        size: '1.8 MB',
        user: { name: 'Daniela Paredes', email: 'daniela.paredes@gmail.com' },
        alertRelated: { id: 'AL-2024-0439', type: 'Acoso', city: 'Barranquilla' },
        type: 'Imagen',
        date: '09/05/2024',
        time: '10:10 p.m.',
        status: 'Pendiente',
      },
      {
        id: 6,
        preview: 'assets/evidence-vid-2.png',
        name: 'VID_20240509_192233.mp4',
        evidenceId: 'EV-2024-0006',
        size: '8.7 MB',
        user: { name: 'Sofía Herrera', email: 'sofia.herrera@gmail.com' },
        alertRelated: { id: 'AL-2024-0435', type: 'Robo', city: 'Neiva' },
        type: 'Video',
        date: '09/05/2024',
        time: '07:22 p.m.',
        status: 'Verificada',
      },
    ];
  }

  /**
   * Calcula las estadísticas globales basadas en las evidencias cargadas
   */
  calculateStats(): void {
    this.totalEvidences = this.evidences.length;
    this.verifiedEvidences = this.evidences.filter(e => e.status === 'Verificada').length;
    this.pendingEvidences = this.evidences.filter(e => e.status === 'Pendiente').length;
    this.rejectedEvidences = this.evidences.filter(e => e.status === 'Rechazada').length;
    // Simulación de descargas
    this.totalDownloads = 1253; // Valor fijo por ahora, se podría calcular dinámicamente
  }

  /**
   * Aplica los filtros de búsqueda, usuario, tipo y estado de evidencia
   */
  applyFilters(): void {
    let tempEvidences = [...this.evidences];

    // Filtrar por término de búsqueda (nombre, descripción o ID de evidencia)
    if (this.searchTermEvidence) {
      const lowerCaseSearchTerm = this.searchTermEvidence.toLowerCase();
      tempEvidences = tempEvidences.filter(evidence =>
        evidence.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        evidence.evidenceId.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    // Filtrar por usuario (nombre o email)
    if (this.searchTermUser) {
      const lowerCaseSearchTerm = this.searchTermUser.toLowerCase();
      tempEvidences = tempEvidences.filter(evidence =>
        evidence.user.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        evidence.user.email.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    // Filtrar por tipo de evidencia
    if (this.filterEvidenceType !== 'all') {
      tempEvidences = tempEvidences.filter(evidence => evidence.type === this.filterEvidenceType);
    }

    // Filtrar por estado
    if (this.filterStatus !== 'all') {
      tempEvidences = tempEvidences.filter(evidence => evidence.status === this.filterStatus);
    }

    // TODO: Implementar filtro por rango de fechas

    this.filteredEvidences = tempEvidences;
    this.currentPage = 1; // Reset pagination on filter change
    this.updatePagination();
  }

  /**
   * Limpia todos los filtros aplicados
   */
  clearFilters(): void {
    this.searchTermEvidence = '';
    this.searchTermUser = '';
    this.filterEvidenceType = 'all';
    this.filterStatus = 'all';
    this.filterDateRange = '';
    this.applyFilters();
  }

  // Lógica de paginación
  get paginatedEvidences(): Evidence[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredEvidences.slice(startIndex, startIndex + this.itemsPerPage);
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredEvidences.length / this.itemsPerPage);
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
   * Helper para asignar la clase CSS correcta al badge de tipo de evidencia
   */
  getEvidenceTypeBadgeClass(type: 'Imagen' | 'Video' | 'Audio' | 'Documento'): string {
    switch (type) {
      case 'Imagen':
        return 'badge-image';
      case 'Video':
        return 'badge-video';
      case 'Audio':
        return 'badge-audio';
      case 'Documento':
        return 'badge-document';
      default:
        return '';
    }
  }

  /**
   * Helper para asignar la clase CSS correcta al badge de estado de evidencia
   */
  getEvidenceStatusBadgeClass(status: 'Verificada' | 'Pendiente' | 'Rechazada'): string {
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

  /**
   * Función trackBy para optimizar el rendimiento de las listas de Angular
   */
  trackByIndex(index: number): number {
    return index;
  }

}
