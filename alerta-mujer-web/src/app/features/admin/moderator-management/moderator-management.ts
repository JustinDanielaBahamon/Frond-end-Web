import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Report {
  id: string;
  userName: string;
  userEmail: string;
  reason: string;
  severity: string;
  date: string;
  status: string;
}

@Component({
  selector: 'app-moderator-management',
  imports: [CommonModule],
  templateUrl: './moderator-management.html',
  styleUrl: './moderator-management.scss',
})
export class ModeratorManagementComponent {
  reports: Report[] = [
    {
      id: '#REP-001',
      userName: 'María García',
      userEmail: 'maria.g@email.com',
      reason: 'Acoso',
      severity: 'Alta',
      date: '23/07/2024 10:30 AM',
      status: 'Pendiente'
    },
    {
      id: '#REP-002',
      userName: 'Carlos Rodríguez',
      userEmail: 'carlos.r@email.com',
      reason: 'Spam',
      severity: 'Media',
      date: '22/07/2024 04:15 PM',
      status: 'En revisión'
    },
    {
      id: '#REP-003',
      userName: 'Ana Martínez',
      userEmail: 'ana.m@email.com',
      reason: 'Contenido inapropiado',
      severity: 'Baja',
      date: '21/07/2024 11:45 AM',
      status: 'Resuelto'
    },
    {
      id: '#REP-004',
      userName: 'Pedro Sánchez',
      userEmail: 'pedro.s@email.com',
      reason: 'Discurso de odio',
      severity: 'Crítica',
      date: '20/07/2024 09:20 AM',
      status: 'Pendiente'
    },
    {
      id: '#REP-005',
      userName: 'Laura López',
      userEmail: 'laura.l@email.com',
      reason: 'Falsificación',
      severity: 'Alta',
      date: '19/07/2024 08:10 PM',
      status: 'Rechazado'
    },
    {
      id: '#REP-006',
      userName: 'Diego Torres',
      userEmail: 'diego.t@email.com',
      reason: 'Acoso',
      severity: 'Media',
      date: '18/07/2024 03:30 PM',
      status: 'En revisión'
    },
    {
      id: '#REP-007',
      userName: 'Sofía Ramírez',
      userEmail: 'sofia.r@email.com',
      reason: 'Spam',
      severity: 'Baja',
      date: '17/07/2024 11:00 AM',
      status: 'Resuelto'
    }
  ];

  stats = {
    pendingReports: 32,
    resolvedCases: 128,
    sanctionedUsers: 15,
    removedContent: 46,
    responseTime: '2h 15m'
  };

  currentPage = 1;
  totalPages = 5;
  itemsPerPage = 7;
  totalItems = 32;

  viewReport(report: Report): void {
    console.log('Viewing report:', report.id);
  }

  approveReport(report: Report): void {
    console.log('Approving report:', report.id);
  }

  rejectReport(report: Report): void {
    console.log('Rejecting report:', report.id);
  }

  clearFilters(): void {
    console.log('Clearing filters');
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }
}
