import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ReportsService } from '../../../core/services/reports.services';
import { AlertsService } from '../../../core/services/alerts.services';
import { ZonesService } from '../../../core/services/zones.Services';
import { Reporte, EstadoReporte } from '../../../core/models/report.model';
import { MedioActivacion } from '../../../core/models/alert.model';

@Component({
  selector: 'app-report-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report-management.html',
  styleUrl: './report-management.scss',
})
export class ReportManagementComponent implements OnInit {

  private reportsService = inject(ReportsService);
  private alertsService = inject(AlertsService);
  private zonesService = inject(ZonesService);

  cargando = true;
  private todos: Reporte[] = [];
  private filtrados: Reporte[] = [];

  // ── Datos de las tarjetas (vienen del db.json) ───────────────
  totalAlertas = 0;
  zonasActivas = 0;

  get totalReportes(): number { return this.todos.length; }

  get totalExportaciones(): number {
    return this.todos.reduce((suma, r) => suma + (r.exportaciones ?? 0), 0);
  }

  // ── Filtros ──────────────────────────────────────────────────
  searchTerm = '';
  fechaInicio = '';
  fechaFin = '';
  filtroCiudad = '';
  filtroMedio = '';
  filtroEstado = '';

  readonly medios: MedioActivacion[] = ['Botón de pánico', 'Widget', 'Movimiento sospechoso', 'Manual'];
  readonly estados: EstadoReporte[] = ['Pendiente', 'Cerrada', 'Atendida'];

  // Ciudades sacadas de los propios reportes
  get ciudades(): string[] {
    return [...new Set(this.todos.map(r => r.ciudad))].sort((a, b) => a.localeCompare(b));
  }

  // ── Paginación ───────────────────────────────────────────────
  reportesPagina: Reporte[] = [];
  paginaActual = 1;
  porPagina = 5;
  totalFiltrados = 0;
  totalPaginas = 1;
  paginas: number[] = [];

  get desde(): number {
    return this.totalFiltrados === 0 ? 0 : (this.paginaActual - 1) * this.porPagina + 1;
  }

  get hasta(): number {
    return Math.min(this.paginaActual * this.porPagina, this.totalFiltrados);
  }

  // ── Lifecycle ────────────────────────────────────────────────
  ngOnInit(): void {
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.cargando = true;

    forkJoin({
      reportes: this.reportsService.getAll(),
      // Si alertas o zonas fallan, los reportes igual se muestran
      alertas: this.alertsService.getAll().pipe(catchError(() => of([]))),
      zonas: this.zonesService.getAll().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ reportes, alertas, zonas }) => {
        // Más recientes primero
        this.todos = [...reportes].sort(
          (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
        );
        this.totalAlertas = alertas.length;
        this.zonasActivas = zonas.filter(z => z.estado === 'Activa').length;

        this.applyFilters();
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error cargando reportes:', err);
        this.cargando = false;
      }
    });
  }

  // ── Filtros y paginación ─────────────────────────────────────
  applyFilters(): void {
    const term = this.searchTerm.trim().toLowerCase();
    const inicio = this.fechaInicio ? new Date(`${this.fechaInicio}T00:00:00`).getTime() : null;
    const fin = this.fechaFin ? new Date(`${this.fechaFin}T23:59:59.999`).getTime() : null;

    this.filtrados = this.todos.filter(r => {
      const t = new Date(r.fecha).getTime();

      const coincideTexto = !term ||
        r.nombre.toLowerCase().includes(term) ||
        r.ciudad.toLowerCase().includes(term) ||
        r.medioActivacion.toLowerCase().includes(term);
      const coincideInicio = inicio === null || t >= inicio;
      const coincideFin = fin === null || t <= fin;
      const coincideCiudad = !this.filtroCiudad || r.ciudad === this.filtroCiudad;
      const coincideMedio = !this.filtroMedio || r.medioActivacion === this.filtroMedio;
      const coincideEstado = !this.filtroEstado || r.estado === this.filtroEstado;

      return coincideTexto && coincideInicio && coincideFin &&
             coincideCiudad && coincideMedio && coincideEstado;
    });

    this.totalFiltrados = this.filtrados.length;
    this.totalPaginas = Math.ceil(this.totalFiltrados / this.porPagina) || 1;
    if (this.paginaActual > this.totalPaginas) this.paginaActual = 1;

    const start = (this.paginaActual - 1) * this.porPagina;
    this.reportesPagina = this.filtrados.slice(start, start + this.porPagina);
    this.paginas = Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  // Cuando cambia un filtro, se vuelve a la página 1
  onFiltroChange(): void {
    this.paginaActual = 1;
    this.applyFilters();
  }

  cambiarPagina(p: number): void {
    if (p < 1 || p > this.totalPaginas) return;
    this.paginaActual = p;
    this.applyFilters();
  }

  limpiarFiltros(): void {
    this.searchTerm = '';
    this.fechaInicio = '';
    this.fechaFin = '';
    this.filtroCiudad = '';
    this.filtroMedio = '';
    this.filtroEstado = '';
    this.paginaActual = 1;
    this.applyFilters();
  }

  // ── Acciones ─────────────────────────────────────────────────
  eliminarReporte(r: Reporte): void {
    if (!confirm(`¿Eliminar "${r.nombre}"?`)) return;

    this.reportsService.eliminar(r.id).subscribe({
      next: () => {
        this.todos = this.todos.filter(x => x.id !== r.id);
        this.applyFilters();
      },
      error: (err) => console.error('Error eliminando reporte:', err)
    });
  }

  // Exporta a CSV (Excel lo abre directo) los reportes que cumplen los filtros
  exportarExcel(): void {
    const encabezado = ['Nombre', 'Fecha', 'Ciudad', 'Modo de activación', 'Estado', 'Generado por'];
    const filas = this.filtrados.map(r => [
      r.nombre,
      new Date(r.fecha).toLocaleString('es-CO'),
      r.ciudad,
      r.medioActivacion,
      r.estado,
      r.generadoPor,
    ]);

    const csv = [encabezado, ...filas]
      .map(fila => fila.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reportes.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // PDF e Imprimir usan el diálogo del navegador (elige "Guardar como PDF")
  imprimir(): void {
    window.print();
  }

  // ── Helpers de estilo ────────────────────────────────────────
  getBadgeClass(medio: MedioActivacion): string {
    const map: Record<MedioActivacion, string> = {
      'Botón de pánico':       'red',
      'Widget':                'blue',
      'Movimiento sospechoso': 'purple',
      'Manual':                'orange',
    };
    return map[medio] ?? '';
  }

  getStatusClass(estado: EstadoReporte): string {
    const map: Record<EstadoReporte, string> = {
      'Pendiente': 'pending',
      'Cerrada':   'closed',
      'Atendida':  'attended',
    };
    return map[estado] ?? '';
  }
}