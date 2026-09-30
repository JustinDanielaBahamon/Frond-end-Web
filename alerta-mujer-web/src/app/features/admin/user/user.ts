import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { UsersService } from '../../../core/services/users.services';
import { Usuario } from '../../../core/models/user.model';
import { Chip } from '../../../shared/components/chip/chip';
import { Modal } from '../../../shared/components/modal/modal';

// Extendemos el modelo real solo con el flag de selección de UI (no vive en la API)
type UsuariaUI = Usuario & { selected?: boolean };

interface ChipData {
  label: string;
  value: string;
  color: string;
  count: number;
}

// Datos que vienen de otras tablas del db.json
export interface ContactoEmergencia {
  id: string;
  user_profile_id: number | string;
  contact_name: string;
  telephone: string;
  relationship: string;
}

export interface AlertaResumen {
  id: string;
  usuarioId: number;
  descripcion: string;
  ubicacion: string;
  status: string;
  created_at: string;
}

// Modelo del formulario (crear / editar)
interface FormUsuaria {
  first_name: string;
  last_name: string;
  email: string;
  telefono: string;
  password: string;
}

const COLORES_AVATAR = ['#7c3aed', '#a78bfa', '#ec4899', '#6d28d9', '#c4b5fd'];

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, FormsModule, Modal, Chip],
  templateUrl: './user.html',
  styleUrl: './user.scss',
})
export class UserComponent implements OnInit {

  private usersService = inject(UsersService);

  cargando = true;

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
  modalForm = false;
  usuariaSeleccionada: UsuariaUI | null = null;
  accionBloqueo: 'bloquear' | 'desbloquear' = 'bloquear';

  // ── Detalle (datos reales de otras tablas) ───────────────────
  alertasDetalle: AlertaResumen[] = [];
  cargandoDetalle = false;

  // ── Formulario ───────────────────────────────────────────────
  modoForm: 'crear' | 'editar' = 'crear';
  guardando = false;
  errorForm = '';
  form: FormUsuaria = this.formVacio();

  Math = Math;

  // ── Chips ────────────────────────────────────────────────────
  get chips(): ChipData[] {
    return [
      { label: 'Todas',                 value: 'Todos',                color: '#7c3aed', count: this.todasLasUsuarias.length },
      { label: 'Activas',               value: 'Activa',               color: '#16a34a', count: this.contar('Activa') },
      { label: 'Inactivas',             value: 'Inactiva',             color: '#d97706', count: this.contar('Inactiva') },
      { label: 'Bloqueadas por Fraude', value: 'Bloqueada por Fraude', color: '#dc2626', count: this.contar('Bloqueada por Fraude') },
    ];
  }

  private contar(estado: string): number {
    return this.todasLasUsuarias.filter(u => u.estado === estado).length;
  }

  // ── Stat cards ───────────────────────────────────────────────
  get totalUsuarias()      { return this.todasLasUsuarias.length; }
  get usuariasActivas()    { return this.contar('Activa'); }
  get usuariasBloqueadas() { return this.contar('Bloqueada por Fraude'); }
  get usuariasInactivas()  { return this.contar('Inactiva'); }

  // ── Lifecycle ────────────────────────────────────────────────
  ngOnInit(): void {
    this.cargarUsuarias();
  }

  private cargarUsuarias(): void {
    this.cargando = true;

    // Traemos usuarias y alertas juntas para calcular el contador real
    forkJoin({
      usuarios: this.usersService.getAll(),
      alertas: this.usersService.getAlertas(),
    }).subscribe({
      next: ({ usuarios, alertas }) => {
        this.todasLasUsuarias = usuarios.map(u => ({
          ...u,
          alertas: alertas.filter(a => String(a.usuarioId) === String(u.id)).length,
        }));
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

  // ── Ver detalle: carga las últimas alertas reales ────────────
  verDetalle(u: UsuariaUI): void {
    this.usuariaSeleccionada = u;
    this.alertasDetalle = [];
    this.cargandoDetalle = true;
    this.modalDetalle = true;

    this.usersService.getAlertasByUsuaria(u.id).subscribe({
      next: (alertas) => {
        // Las más recientes primero, máximo 5
        this.alertasDetalle = [...alertas]
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 5);
        this.cargandoDetalle = false;
      },
      error: (err) => {
        console.error('Error cargando detalle:', err);
        this.cargandoDetalle = false;
      }
    });
  }

  restablecerPassword(u: UsuariaUI): void {
    // TODO: cuando exista el backend, llamar al endpoint de recuperación
    alert(`Se envió un correo de restablecimiento a ${u.email}`);
    this.cerrarModales();
  }

  toggleBloqueo(u: UsuariaUI): void {
    this.usuariaSeleccionada = u;
    this.accionBloqueo = u.estado === 'Bloqueada por Fraude' ? 'desbloquear' : 'bloquear';
    this.modalBloqueo = true;
  }

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

  // ── Formulario crear / editar ────────────────────────────────
  private formVacio(): FormUsuaria {
    return { first_name: '', last_name: '', email: '', telefono: '', password: '' };
  }

  abrirModalNueva(): void {
    this.modoForm = 'crear';
    this.form = this.formVacio();
    this.errorForm = '';
    this.usuariaSeleccionada = null;
    this.modalForm = true;
  }

  abrirModalEditar(u: UsuariaUI): void {
    this.modoForm = 'editar';
    this.usuariaSeleccionada = u;
    this.form = {
      first_name: u.first_name ?? u.nombre.split(' ')[0],
      last_name: u.last_name ?? '',
      email: u.email,
      telefono: u.telefono,
      password: '', // vacío = no cambiar
    };
    this.errorForm = '';
    this.modalDetalle = false;
    this.modalForm = true;
  }

  guardarUsuaria(): void {
    this.errorForm = '';

    const email = this.form.email.trim().toLowerCase();
    const duplicado = this.todasLasUsuarias.some(u =>
      u.email.toLowerCase() === email &&
      (this.modoForm === 'crear' || u.id !== this.usuariaSeleccionada?.id)
    );
    if (duplicado) {
      this.errorForm = 'Ya existe una usuaria con ese correo.';
      return;
    }

    this.guardando = true;

    if (this.modoForm === 'crear') {
      const nombreCompleto = `${this.form.first_name.trim()} ${this.form.last_name.trim()}`.trim();
      const ahora = new Date();
      const dd = String(ahora.getDate()).padStart(2, '0');
      const mm = String(ahora.getMonth() + 1).padStart(2, '0');

      const nueva = {
        nombre: nombreCompleto,
        first_name: this.form.first_name.trim(),
        last_name: this.form.last_name.trim(),
        email,
        correo: email,
        telefono: this.form.telefono.trim(),
        fechaRegistro: `${dd}/${mm}/${ahora.getFullYear()}`,
        alertas: 0,
        ultimaActividad: 'recién registrada',
        estado: 'Activa',
        rol: 'Usuaria',
        role_id: 1,
        contactoEmergencia: 'N/A',
        avatarColor: COLORES_AVATAR[Math.floor(Math.random() * COLORES_AVATAR.length)],
        document_number: '',
        document_type: '',
        birthdate: null,
        created_at: ahora.toISOString(),
        password: this.form.password,
      };

      this.usersService.crearUsuaria(nueva).subscribe({
        next: (creada) => {
          this.todasLasUsuarias = [...this.todasLasUsuarias, creada];
          this.finalizarGuardado();
        },
        error: (err) => this.manejarErrorGuardado(err),
      });
    } else {
      const u = this.usuariaSeleccionada!;
      const cambios: Partial<Usuario> & Record<string, unknown> = {
        nombre: `${this.form.first_name.trim()} ${this.form.last_name.trim()}`.trim(),
        first_name: this.form.first_name.trim(),
        last_name: this.form.last_name.trim(),
        email,
        correo: email,
        telefono: this.form.telefono.trim(),
      };
      if (this.form.password) cambios['password'] = this.form.password;

      this.usersService.actualizarUsuaria(u.id, cambios).subscribe({
        next: (actualizada) => {
          this.todasLasUsuarias = this.todasLasUsuarias.map(x =>
            x.id === actualizada.id ? { ...x, ...actualizada, alertas: x.alertas } : x
          );
          this.finalizarGuardado();
        },
        error: (err) => this.manejarErrorGuardado(err),
      });
    }
  }

  private finalizarGuardado(): void {
    this.guardando = false;
    this.cerrarModales();
    this.applyFilters();
  }

  private manejarErrorGuardado(err: unknown): void {
    console.error('Error guardando usuaria:', err);
    this.guardando = false;
    this.errorForm = 'No se pudo guardar. Intenta de nuevo.';
  }

  cerrarModales(): void {
    this.modalDetalle = false;
    this.modalBloqueo = false;
    this.modalForm = false;
    this.usuariaSeleccionada = null;
    this.errorForm = '';
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