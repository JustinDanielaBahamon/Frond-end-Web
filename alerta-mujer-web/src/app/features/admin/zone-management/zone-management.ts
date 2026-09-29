import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ZonesService } from '../../../core/services/zones.Services';
import { Zona, TipoZona, EstadoZona } from '../../../core/models/zone-management-model';

interface ChipFiltro {
  label: string;
  value: string;
}

@Component({
  selector: 'app-zone-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './zone-management.html',
  styleUrl: './zone-management.scss',
})
export class ZoneManagementComponent implements OnInit {

  private zonesService = inject(ZonesService);

  cargando = true;
  private todasLasZonas: Zona[] = [];

  // ── Estado UI ────────────────────────────────────────────────
  zonasFiltradas: Zona[] = [];
  searchTerm = '';
  filtroTipo = 'Todas';

  readonly chips: ChipFiltro[] = [
    { label: 'Todas',        value: 'Todas' },
    { label: 'Riesgo Alto',  value: 'Riesgo Alto' },
    { label: 'Riesgo Medio', value: 'Riesgo Medio' },
    { label: 'Riesgo Bajo',  value: 'Riesgo Bajo' },
    { label: 'Seguras',      value: 'Segura' },
  ];

  paginaActual = 1;
  porPagina = 6;
  totalFiltradas = 0;
  totalPaginas = 1;
  paginas: number[] = [];

  // ── Estadísticas ─────────────────────────────────────────────
  get totalZonas()       { return this.todasLasZonas.length; }
  get zonasRiesgoAlto()  { return this.todasLasZonas.filter(z => z.tipo === 'Riesgo Alto').length; }
  get zonasSeguras()     { return this.todasLasZonas.filter(z => z.tipo === 'Segura').length; }
  get zonasEnRevision()  { return this.todasLasZonas.filter(z => z.estado === 'Revisión').length; }

  // ── Texto de paginación ──────────────────────────────────────
  get desde(): number {
    return this.totalFiltradas === 0 ? 0 : (this.paginaActual - 1) * this.porPagina + 1;
  }

  get hasta(): number {
    return Math.min(this.paginaActual * this.porPagina, this.totalFiltradas);
  }

  // ── Lifecycle ────────────────────────────────────────────────
  ngOnInit(): void {
    this.cargarZonas();
  }

  private cargarZonas(): void {
    this.cargando = true;
    this.zonesService.getAll().subscribe({
      next: (zonas) => {
        this.todasLasZonas = zonas;
        this.applyFilters();
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error cargando zonas:', err);
        this.cargando = false;
      }
    });
  }

  // ── Filtros y paginación ─────────────────────────────────────
  applyFilters(): void {
    let resultado = [...this.todasLasZonas];

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      resultado = resultado.filter(z =>
        z.nombre.toLowerCase().includes(term) ||
        z.ciudad.toLowerCase().includes(term)
      );
    }

    if (this.filtroTipo !== 'Todas') {
      resultado = resultado.filter(z => z.tipo === this.filtroTipo);
    }

    this.totalFiltradas = resultado.length;
    this.totalPaginas = Math.ceil(this.totalFiltradas / this.porPagina) || 1;
    if (this.paginaActual > this.totalPaginas) this.paginaActual = 1;

    const start = (this.paginaActual - 1) * this.porPagina;
    this.zonasFiltradas = resultado.slice(start, start + this.porPagina);
    this.paginas = Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  setChip(value: string): void {
    this.filtroTipo = value;
    this.paginaActual = 1;
    this.applyFilters();
  }

  cambiarPagina(p: number): void {
    if (p < 1 || p > this.totalPaginas) return;
    this.paginaActual = p;
    this.applyFilters();
  }

  clearAll(): void {
    this.searchTerm = '';
    this.filtroTipo = 'Todas';
    this.paginaActual = 1;
    this.applyFilters();
  }

  // ── Acciones ─────────────────────────────────────────────────
  eliminarZona(z: Zona): void {
    if (!confirm(`¿Eliminar la zona "${z.nombre}"?`)) return;

    this.zonesService.eliminar(z.id).subscribe({
      next: () => {
        this.todasLasZonas = this.todasLasZonas.filter(x => x.id !== z.id);
        this.applyFilters();
      },
      error: (err) => console.error('Error eliminando zona:', err)
    });
  }

  // ── Helpers de estilo ────────────────────────────────────────
  getAvatarClass(tipo: TipoZona): string {
    const map: Record<TipoZona, string> = {
      'Riesgo Alto':  'red',
      'Riesgo Medio': 'yellow',
      'Riesgo Bajo':  'orange',
      'Segura':       'green',
    };
    return map[tipo] ?? '';
  }

  getBadgeClass(tipo: TipoZona): string {
    const map: Record<TipoZona, string> = {
      'Riesgo Alto':  'badge-red',
      'Riesgo Medio': 'badge-yellow',
      'Riesgo Bajo':  'badge-orange',
      'Segura':       'badge-green',
    };
    return map[tipo] ?? '';
  }

  getStatusClass(estado: EstadoZona): string {
    const map: Record<EstadoZona, string> = {
      'Activa':   'active',
      'Revisión': 'review',
      'Inactiva': 'inactive',
    };
    return map[estado] ?? '';
  }

  // "Hace 2 horas", "Hace 1 día", etc. a partir de la fecha ISO
  tiempoRelativo(iso: string): string {
    const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);

    if (minutos < 1)  return 'Hace un momento';
    if (minutos < 60) return `Hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;

    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;

    const dias = Math.floor(horas / 24);
    return `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
  }
}