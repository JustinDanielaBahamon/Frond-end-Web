import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface Usuaria {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  fechaRegistro: string;
  alertas: number;
  ultimaActividad: string;
  estado: 'Activa' | 'Inactiva' | 'Bloqueada por Fraude';
  rol: string;
  contactoEmergencia: string;
  avatarColor: string;
  selected?: boolean;
}

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

  // ── Datos mock ──────────────────────────────────────────────
  private todasLasUsuarias: Usuaria[] = [
    { id: 1,  nombre: 'María Gómez',    email: 'mariagomez@gmail.com',  telefono: '+57 311 000 0001', fechaRegistro: '29/05/2023', alertas: 7,  ultimaActividad: 'hace 2 horas',   estado: 'Activa',               rol: 'Usuaria', contactoEmergencia: 'Ana Gómez (+57 311 111 0001)',      avatarColor: '#7c3aed' },
    { id: 2,  nombre: 'Carmen Díaz',    email: 'carmendiaz@gmail.com',  telefono: '+57 312 000 0002', fechaRegistro: '27/05/2023', alertas: 2,  ultimaActividad: 'hace 3 días',    estado: 'Inactiva',             rol: 'Usuaria', contactoEmergencia: 'Luis Díaz (+57 312 111 0002)',       avatarColor: '#a78bfa' },
    { id: 3,  nombre: 'Ana Flores',     email: 'anaflores@gmail.com',   telefono: '+57 313 000 0003', fechaRegistro: '27/05/2023', alertas: 12, ultimaActividad: 'hace 1 semana',  estado: 'Bloqueada por Fraude', rol: 'Usuaria', contactoEmergencia: 'Pedro Flores (+57 313 111 0003)',    avatarColor: '#ec4899' },
    { id: 4,  nombre: 'Aaría Gomez',    email: 'aanflores@gmail.com',   telefono: '+57 314 000 0004', fechaRegistro: '27/05/2023', alertas: 9,  ultimaActividad: 'hace 5 días',    estado: 'Bloqueada por Fraude', rol: 'Usuaria', contactoEmergencia: 'Rosa Gomez (+57 314 111 0004)',      avatarColor: '#6d28d9' },
    { id: 5,  nombre: 'Marielilania',   email: 'mariatian@gmail.com',   telefono: '+57 315 000 0005', fechaRegistro: '27/05/2023', alertas: 3,  ultimaActividad: 'hace 1 hora',    estado: 'Activa',               rol: 'Usuaria', contactoEmergencia: 'José Tian (+57 315 111 0005)',       avatarColor: '#7c3aed' },
    { id: 6,  nombre: 'Díaz Giores',    email: 'anaflores2@gmail.com',  telefono: '+57 316 000 0006', fechaRegistro: '27/05/2023', alertas: 15, ultimaActividad: 'hace 2 semanas', estado: 'Bloqueada por Fraude', rol: 'Usuaria', contactoEmergencia: 'N/A',                               avatarColor: '#c4b5fd' },
    { id: 7,  nombre: 'Ana Flores',     email: 'anaflarta@gmail.com',   telefono: '+57 317 000 0007', fechaRegistro: '27/05/2023', alertas: 6,  ultimaActividad: 'hace 4 días',    estado: 'Bloqueada por Fraude', rol: 'Usuaria', contactoEmergencia: 'María Flores (+57 317 111 0007)',    avatarColor: '#ec4899' },
    { id: 8,  nombre: 'María Gómez',    email: 'mariagona@gmail.com',   telefono: '+57 318 000 0008', fechaRegistro: '27/05/2023', alertas: 1,  ultimaActividad: 'hace 30 min',    estado: 'Activa',               rol: 'Usuaria', contactoEmergencia: 'Carlos Gómez (+57 318 111 0008)',    avatarColor: '#a78bfa' },
    { id: 9,  nombre: 'Clarna Díaz',    email: 'carmendiaz2@gmail.com', telefono: '+57 319 000 0009', fechaRegistro: '27/05/2023', alertas: 4,  ultimaActividad: 'hace 2 horas',   estado: 'Activa',               rol: 'Usuaria', contactoEmergencia: 'Sofía Díaz (+57 319 111 0009)',      avatarColor: '#7c3aed' },
    { id: 10, nombre: 'Martia Gómez',   email: 'marflorerz@gmail.com',  telefono: '+57 320 000 0010', fechaRegistro: '27/05/2023', alertas: 11, ultimaActividad: 'hace 1 semana',  estado: 'Bloqueada por Fraude', rol: 'Usuaria', contactoEmergencia: 'Juan Gómez (+57 320 111 0010)',      avatarColor: '#6d28d9' },
    { id: 11, nombre: 'Laura Martínez', email: 'lauramtz@gmail.com',    telefono: '+57 321 000 0011', fechaRegistro: '01/06/2023', alertas: 0,  ultimaActividad: 'hace 6 días',    estado: 'Inactiva',             rol: 'Usuaria', contactoEmergencia: 'Pablo Martínez (+57 321 111 0011)', avatarColor: '#c4b5fd' },
    { id: 12, nombre: 'Sofía Herrera',  email: 'sofiaherr@gmail.com',   telefono: '+57 322 000 0012', fechaRegistro: '05/06/2023', alertas: 5,  ultimaActividad: 'hace 3 horas',   estado: 'Activa',               rol: 'Usuaria', contactoEmergencia: 'Luis Herrera (+57 322 111 0012)',    avatarColor: '#ec4899' },
  ];

  // ── Estado UI ────────────────────────────────────────────────
  usuariasFiltradas: Usuaria[] = [];
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
  usuariaSeleccionada: Usuaria | null = null;
  accionBloqueo: 'bloquear' | 'desbloquear' = 'bloquear';

  // ── Math para template ───────────────────────────────────────
  Math = Math;

  // ── Chips ────────────────────────────────────────────────────
  get chips(): Chip[] {
    return [
      { label: 'Todas',                 value: 'Todos',               color: '#7c3aed', count: this.todasLasUsuarias.length },
      { label: 'Activas',               value: 'Activa',              color: '#16a34a', count: this.todasLasUsuarias.filter(u => u.estado === 'Activa').length },
      { label: 'Inactivas',             value: 'Inactiva',            color: '#d97706', count: this.todasLasUsuarias.filter(u => u.estado === 'Inactiva').length },
      { label: 'Bloqueadas por Fraude', value: 'Bloqueada por Fraude',color: '#dc2626', count: this.todasLasUsuarias.filter(u => u.estado === 'Bloqueada por Fraude').length },
    ];
  }

  // ── Stat cards ───────────────────────────────────────────────
  get totalUsuarias()      { return this.todasLasUsuarias.length; }
  get usuariasActivas()    { return this.todasLasUsuarias.filter(u => u.estado === 'Activa').length; }
  get usuariasBloqueadas() { return this.todasLasUsuarias.filter(u => u.estado === 'Bloqueada por Fraude').length; }
  get usuariasInactivas()  { return this.todasLasUsuarias.filter(u => u.estado === 'Inactiva').length; }

  // ── Lifecycle ────────────────────────────────────────────────
  ngOnInit(): void {
    this.applyFilters();
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

  bloquearSeleccionadas(): void {
    this.usuariasFiltradas
      .filter(u => u.selected)
      .forEach(u => {
        const original = this.todasLasUsuarias.find(x => x.id === u.id);
        if (original) original.estado = 'Bloqueada por Fraude';
      });
    this.deselectAll();
    this.applyFilters();
  }

  // ── Acciones de fila ─────────────────────────────────────────
  verDetalle(u: Usuaria): void {
    this.usuariaSeleccionada = u;
    this.modalDetalle = true;
  }

  restablecerPassword(u: Usuaria): void {
    alert(`Se envió un correo de restablecimiento a ${u.email}`);
    this.cerrarModales();
  }

  toggleBloqueo(u: Usuaria): void {
    this.usuariaSeleccionada = u;
    this.accionBloqueo = u.estado === 'Bloqueada por Fraude' ? 'desbloquear' : 'bloquear';
    this.modalBloqueo = true;
  }

  confirmarBloqueo(): void {
    if (!this.usuariaSeleccionada) return;
    const original = this.todasLasUsuarias.find(x => x.id === this.usuariaSeleccionada!.id);
    if (original) {
      original.estado = this.accionBloqueo === 'bloquear' ? 'Bloqueada por Fraude' : 'Activa';
    }
    this.cerrarModales();
    this.applyFilters();
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