import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { UsersService } from '../../../core/services/users.services';
import { Usuario } from '../../../core/models/user.model';

// Extendemos el modelo real solo con el flag de selección de UI (no vive en la API)
type UsuariaUI = Usuario & { selected?: boolean };

interface Chip {
  label: string;
  value: string;
  color: string;
  count: number;
}

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user.html',
  styleUrl: './user.scss',
})
export class UserComponent implements OnInit {

  private usersService = inject(UsersService);

  cargando = true;

  // ── Datos reales (ya no mock) ──────────────────────────────
  private todasLasUsuarias: UsuariaUI[] = [];

  // ── Estado UI ────────────────────────────────────────────────
  usuariasFiltradas: UsuariaUI[] = [];
  searchTerm = '';
  filtroEstado = 'Todos';

  paginaActual = 1;
  porPagina: number = 10;
  totalFiltradas = 0;
  totalPaginas = 1;
  paginas: number[] = [];

  selectedCount = 0;
  allSelected = false;

  // ── Modales ──────────────────────────────────────────────────
  modalDetalle = false;
  modalBloqueo = false;
  usuariaSeleccionada: UsuariaUI | null = null;
  accionBloqueo: 'bloquear' | 'desbloquear' = 'bloquear';

  Math = Math;

  // ── Chips ────────────────────────────────────────────────────
  get chips(): Chip[] {
    return [
      { label: 'Todas',                 value: 'Todos',                color: '#7c3aed', count: this.todasLasUsuarias.length },
      { label: 'Activas',               value: 'Activa',               color: '#16a34a', count: this.todasLasUsuarias.filter(u => u.estado === 'Activa').length },
      { label: 'Inactivas',             value: 'Inactiva',             color: '#d97706', count: this.todasLasUsuarias.filter(u => u.estado === 'Inactiva').length },
      { label: 'Bloqueadas por Fraude', value: 'Bloqueada por Fraude', color: '#dc2626', count: this.todasLasUsuarias.filter(u => u.estado === 'Bloqueada por Fraude').length },
    ];
  }

  // ── Stat cards ───────────────────────────────────────────────
  get totalUsuarias()      { return this.todasLasUsuarias.length; }
  get usuariasActivas()    { return this.todasLasUsuarias.filter(u => u.estado === 'Activa').length; }
  get usuariasBloqueadas() { return this.todasLasUsuarias.filter(u => u.estado === 'Bloqueada por Fraude').length; }
  get usuariasInactivas()  { return this.todasLasUsuarias.filter(u => u.estado === 'Inactiva').length; }

  // ── Lifecycle ────────────────────────────────────────────────
  ngOnInit(): void {
    this.cargarUsuarias();
  }

  private cargarUsuarias(): void {
    this.cargando = true;
    this.usersService.getAll().subscribe({
      next: (usuarios) => {
        this.todasLasUsuarias = usuarios;
        this.applyFilters();
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error cargando usuarias:', err);
        this.cargando = false;
      }
    });
  }

  // ── Filtros y paginación ─────────────────────────────────────
  applyFilters(): void {
    let resultado = [...this.todasLasUsuarias];

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      resultado = resultado.filter(u =>
        u.nombre.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.telefono.includes(term)
      );
    }

    if (this.filtroEstado !== 'Todos') {
      resultado = resultado.filter(u => u.estado === this.filtroEstado);
    }

    this.totalFiltradas = resultado.length;
    this.totalPaginas = Math.ceil(this.totalFiltradas / this.porPagina) || 1;
    if (this.paginaActual > this.totalPaginas) this.paginaActual = 1;

    const start = (this.paginaActual - 1) * this.porPagina;
    this.usuariasFiltradas = resultado.slice(start, start + this.porPagina);
    this.paginas = Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
    this.updateSelection();
  }

  cambiarPagina(p: number): void {
    if (p < 1 || p > this.totalPaginas) return;
    this.paginaActual = p;
    this.applyFilters();
  }

  setChip(value: string): void {
    this.filtroEstado = value;
    this.paginaActual = 1;
    this.applyFilters();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilters();
  }

  clearAll(): void {
    this.searchTerm = '';
    this.filtroEstado = 'Todos';
    this.applyFilters();
  }

  // ── Selección ────────────────────────────────────────────────
  toggleAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.usuariasFiltradas.forEach(u => u.selected = checked);
    this.updateSelection();
  }

  updateSelection(): void {
    this.selectedCount = this.usuariasFiltradas.filter(u => u.selected).length;
    this.allSelected = this.selectedCount === this.usuariasFiltradas.length && this.usuariasFiltradas.length > 0;
  }

  deselectAll(): void {
    this.usuariasFiltradas.forEach(u => u.selected = false);
    this.updateSelection();
  }

  // ── Bloqueo masivo vía API ────────────────────────────────────
  bloquearSeleccionadas(): void {
    const seleccionadas = this.usuariasFiltradas.filter(u => u.selected);

    seleccionadas.forEach(u => {
      this.usersService.updateEstado(u.id, 'Bloqueada por Fraude').subscribe({
        next: (usuarioActualizado) => {
          const original = this.todasLasUsuarias.find(x => x.id === usuarioActualizado.id);
          if (original) original.estado = usuarioActualizado.estado;
          this.applyFilters();
        },
        error: (err) => console.error('Error bloqueando usuaria:', err)
      });
    });

    this.deselectAll();
  }

  // ── Acciones de fila ─────────────────────────────────────────
  verDetalle(u: UsuariaUI): void {
    this.usuariaSeleccionada = u;
    this.modalDetalle = true;
  }

  restablecerPassword(u: UsuariaUI): void {
    alert(`Se envió un correo de restablecimiento a ${u.email}`);
    this.cerrarModales();
  }

  toggleBloqueo(u: UsuariaUI): void {
    this.usuariaSeleccionada = u;
    this.accionBloqueo = u.estado === 'Bloqueada por Fraude' ? 'desbloquear' : 'bloquear';
    this.modalBloqueo = true;
  }

  // ── Confirmar bloqueo/desbloqueo vía API ─────────────────────
  confirmarBloqueo(): void {
    if (!this.usuariaSeleccionada) return;

    const nuevoEstado: Usuario['estado'] =
      this.accionBloqueo === 'bloquear' ? 'Bloqueada por Fraude' : 'Activa';

    this.usersService.updateEstado(this.usuariaSeleccionada.id, nuevoEstado).subscribe({
      next: (usuarioActualizado) => {
        const original = this.todasLasUsuarias.find(x => x.id === usuarioActualizado.id);
        if (original) original.estado = usuarioActualizado.estado;
        this.cerrarModales();
        this.applyFilters();
      },
      error: (err) => console.error('Error actualizando estado:', err)
    });
  }

  abrirModalNueva(): void {
    alert('Formulario de nueva usuaria (próximamente)');
  }

  cerrarModales(): void {
    this.modalDetalle = false;
    this.modalBloqueo = false;
    this.usuariaSeleccionada = null;
  }

  // ── Helpers de estilo ────────────────────────────────────────
  getEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      'Activa':               'estado--activa',
      'Inactiva':             'estado--inactiva',
      'Bloqueada por Fraude': 'estado--bloqueada',
    };
    return map[estado] ?? '';
  }
}