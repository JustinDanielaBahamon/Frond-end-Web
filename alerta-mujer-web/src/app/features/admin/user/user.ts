import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { CelularAdmin, HistorialModeracion, UsersService } from '../../../core/services/users.services';
import { reducirFoto } from '../../../core/utils/foto';
import { Usuario } from '../../../core/models/user.model';
import { Chip } from '../../../shared/components/chip/chip';
import { Modal } from '../../../shared/components/modal/modal';

// Extendemos el modelo real solo con el flag de selección de UI (no vive en la API)
type UsuariaUI = Usuario & { selected?: boolean };

/** Motivos para bloquear una cuenta (quedan en el caso de moderación). */
export const MOTIVOS_BLOQUEO = [
  'Falsas alarmas reiteradas',
  'Fraude o suplantación de identidad',
  'Acoso o amenazas',
  'Uso indebido de la plataforma',
  'Solicitud de las autoridades',
  'Otro',
];

const PERMISOS_ETIQUETA: Record<string, string> = {
  ubicacion: 'Ubicación', notificaciones: 'Notificaciones', agitar: 'Agitar para alertar', bateria: 'Batería sin restricciones',
  pantallaCompleta: 'Pantalla completa', microfono: 'Micrófono', camara: 'Cámara',
};

const TIPO_HISTORIAL: Record<string, string> = {
  block: 'Cuenta bloqueada', unblock: 'Cuenta desbloqueada', deletion_pending: 'Eliminación solicitada',
  deletion_approved: 'Cuenta eliminada', deletion_rejected: 'Eliminación rechazada',
};

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
}


@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, FormsModule, Modal, Chip],
  templateUrl: './user.html',
  styleUrl: './user.scss',
})
export class UserComponent implements OnInit {

  private usersService = inject(UsersService);
  private cdr = inject(ChangeDetectorRef);

  cargando = true;

  private todasLasUsuarias: UsuariaUI[] = [];

  // ── Estado UI ────────────────────────────────────────────────
  usuariasFiltradas: UsuariaUI[] = [];
  searchTerm = '';
  filtroEstado = 'Todos';

  paginaActual = 1;
  readonly porPagina = 6;
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
  readonly motivosBloqueo = MOTIVOS_BLOQUEO;
  /** Una o varias (bloqueo masivo) usuarias del modal de bloqueo. */
  usuariasBloqueo: UsuariaUI[] = [];
  motivoBloqueo = '';
  descripcionBloqueo = '';
  evidenciaBloqueo: string | null = null;
  errorBloqueo = '';
  guardandoBloqueo = false;

  // Detalle: celulares, permisos e historial de moderación
  celularesDetalle: CelularAdmin[] = [];
  historialDetalle: HistorialModeracion[] = [];
  evidenciaAbierta: string | null = null;

  // Eliminación (la aprueba otra administradora)
  modalEliminar = false;
  motivoEliminar = '';
  errorEliminar = '';
  guardandoEliminar = false;

  aviso = '';

  // ── Detalle (datos reales de otras tablas) ───────────────────
  alertasDetalle: AlertaResumen[] = [];
  cargandoDetalle = false;

  // ── Formulario ───────────────────────────────────────────────
  modoForm: 'editar' = 'editar';
  guardando = false;
  errorForm = '';
  form: FormUsuaria = this.formVacio();

  Math = Math;

  // ── Chips ────────────────────────────────────────────────────
  get chips(): ChipData[] {
    return [
      { label: 'Todas',                 value: 'Todos',                color: '#7c3aed', count: this.todasLasUsuarias.length },
      { label: 'Activas',               value: 'Activa',               color: '#7c3aed', count: this.contar('Activa') },
      { label: 'Inactivas',             value: 'Inactiva',             color: '#9333ea', count: this.contar('Inactiva') },
      { label: 'Bloqueadas por Fraude', value: 'Bloqueada por Fraude', color: '#c026d3', count: this.contar('Bloqueada por Fraude') },
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

    // El DTO ya trae el contador de alertas calculado por el backend
    this.usersService.getAll().subscribe({
      next: (usuarios) => {
        this.todasLasUsuarias = usuarios;
        this.applyFilters();
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando usuarias:', err);
        this.cargando = false;
        this.cdr.detectChanges();
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
    const seleccionadas = this.usuariasFiltradas.filter(u => u.selected && u.estado !== 'Bloqueada por Fraude');
    if (seleccionadas.length === 0) return;
    this.abrirBloqueo(seleccionadas, 'bloquear');
  }

  // ── Ver detalle: carga las últimas alertas reales ────────────
  verDetalle(u: UsuariaUI): void {
    this.usuariaSeleccionada = u;
    this.alertasDetalle = [];
    this.celularesDetalle = [];
    this.historialDetalle = [];
    this.cargandoDetalle = true;
    this.modalDetalle = true;
    this.usersService.celulares().subscribe({
      next: (lista) => {
        this.celularesDetalle = lista.filter(c => String(c.userId) === String(u.id) && c.osName !== 'web');
        this.cdr.detectChanges();
      },
      error: () => {},
    });
    this.usersService.historial(u.id).subscribe({
      next: (h) => {
        this.historialDetalle = h;
        this.cdr.detectChanges();
      },
      error: () => {},
    });

    // GET /api/alerts/user/{usersId} acepta users.id para admin
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

  /** La contraseña solo la cambia la usuaria: se le envía el correo con el código. */
  restablecerPassword(u: UsuariaUI): void {
    this.usersService.enviarRecuperacion(u.email).subscribe({
      next: () => this.mostrarAviso(`Enviamos a ${u.email} un código para que cree una contraseña nueva.`),
      error: () => this.mostrarAviso('No se pudo enviar el correo de recuperación. Intenta de nuevo.'),
    });
  }

  toggleBloqueo(u: UsuariaUI): void {
    this.abrirBloqueo([u], u.estado === 'Bloqueada por Fraude' ? 'desbloquear' : 'bloquear');
  }

  private abrirBloqueo(usuarias: UsuariaUI[], accion: 'bloquear' | 'desbloquear'): void {
    this.usuariasBloqueo = usuarias;
    this.usuariaSeleccionada = usuarias[0];
    this.accionBloqueo = accion;
    this.motivoBloqueo = '';
    this.descripcionBloqueo = '';
    this.evidenciaBloqueo = null;
    this.errorBloqueo = '';
    this.modalDetalle = false;
    this.modalBloqueo = true;
  }

  async elegirEvidencia(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    try {
      // Captura legible pero liviana (el servidor acepta hasta ~300 KB)
      this.evidenciaBloqueo = await reducirFoto(archivo, 1100);
      this.errorBloqueo = '';
    } catch (e) {
      this.errorBloqueo = e instanceof Error ? e.message : 'No se pudo usar la imagen';
    }
    this.cdr.detectChanges();
  }

  get bloqueoValido(): boolean {
    const nota = this.descripcionBloqueo.trim().length >= 10;
    return this.accionBloqueo === 'desbloquear' ? nota : nota && !!this.motivoBloqueo;
  }

  confirmarBloqueo(): void {
    if (!this.bloqueoValido || this.guardandoBloqueo) return;
    this.guardandoBloqueo = true;
    this.errorBloqueo = '';
    const descripcion = this.descripcionBloqueo.trim();
    const peticiones = this.usuariasBloqueo.map(u => this.accionBloqueo === 'bloquear'
      ? this.usersService.bloquear(u.id, this.motivoBloqueo, descripcion, this.evidenciaBloqueo)
      : this.usersService.desbloquear(u.id, descripcion));
    forkJoin(peticiones).subscribe({
      next: () => {
        const n = this.usuariasBloqueo.length;
        this.mostrarAviso(this.accionBloqueo === 'bloquear'
          ? `${n === 1 ? 'Cuenta bloqueada' : n + ' cuentas bloqueadas'}. El caso quedó registrado en Moderación.`
          : 'Cuenta desbloqueada.');
        this.guardandoBloqueo = false;
        this.deselectAll();
        this.cerrarModales();
        this.cargarUsuarias();
      },
      error: (err) => {
        this.guardandoBloqueo = false;
        this.errorBloqueo = err?.error?.message ?? 'No se pudo completar. Intenta de nuevo.';
        this.cdr.detectChanges();
      },
    });
  }

  verEvidencia(item: HistorialModeracion): void {
    if (!item.casoId) return;
    this.usersService.evidenciaDeCaso(item.casoId).subscribe({
      next: (e) => {
        this.evidenciaAbierta = e;
        this.cdr.detectChanges();
      },
    });
  }

  // ── Eliminar cuenta (la aprueba otra administradora) ─────────
  abrirEliminar(u: UsuariaUI): void {
    this.usuariaSeleccionada = u;
    this.motivoEliminar = '';
    this.errorEliminar = '';
    this.modalDetalle = false;
    this.modalEliminar = true;
  }

  solicitarEliminacion(): void {
    const u = this.usuariaSeleccionada;
    if (!u || this.motivoEliminar.trim().length < 10 || this.guardandoEliminar) return;
    this.guardandoEliminar = true;
    this.usersService.solicitarEliminacion(u.id, this.motivoEliminar.trim()).subscribe({
      next: () => {
        this.guardandoEliminar = false;
        this.cerrarModales();
        this.mostrarAviso('Solicitud enviada. Otra administradora debe aprobarla en Moderación.');
      },
      error: (err) => {
        this.guardandoEliminar = false;
        this.errorEliminar = err?.error?.message ?? 'No se pudo enviar la solicitud.';
        this.cdr.detectChanges();
      },
    });
  }

  // ── Ayudas del detalle ───────────────────────────────────────
  permisosDe(c: CelularAdmin): { nombre: string; ok: boolean }[] {
    if (!c.permissions) return [];
    try {
      const datos = JSON.parse(c.permissions) as Record<string, boolean>;
      return Object.entries(datos).map(([k, v]) => ({ nombre: PERMISOS_ETIQUETA[k] ?? k, ok: v === true }));
    } catch {
      return [];
    }
  }

  nombreCelular(c: CelularAdmin): string {
    return c.deviceName || [c.brand, c.model].filter(Boolean).join(' ') || 'Celular';
  }

  tipoHistorial(t: string): string {
    return TIPO_HISTORIAL[t] ?? t;
  }

  private mostrarAviso(texto: string): void {
    this.aviso = texto;
    this.cdr.detectChanges();
    setTimeout(() => {
      if (this.aviso === texto) {
        this.aviso = '';
        this.cdr.detectChanges();
      }
    }, 5000);
  }

  // ── Formulario crear / editar ────────────────────────────────
  private formVacio(): FormUsuaria {
    return { first_name: '', last_name: '', email: '', telefono: '' };
  }

  abrirModalEditar(u: UsuariaUI): void {
    this.modoForm = 'editar';
    this.usuariaSeleccionada = u;
    this.form = {
      first_name: u.first_name ?? u.nombre.split(' ')[0],
      last_name: u.last_name ?? '',
      email: u.email,
      telefono: u.telefono,
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
      u.id !== this.usuariaSeleccionada?.id
    );
    if (duplicado) {
      this.errorForm = 'Ya existe una usuaria con ese correo.';
      return;
    }

    this.guardando = true;

    {
      const u = this.usuariaSeleccionada!;
      const cambios: Partial<Usuario> & Record<string, unknown> = {
        nombre: `${this.form.first_name.trim()} ${this.form.last_name.trim()}`.trim(),
        first_name: this.form.first_name.trim(),
        last_name: this.form.last_name.trim(),
        email,
        correo: email,
        telefono: this.form.telefono.trim(),
      };

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
    this.modalEliminar = false;
    this.evidenciaAbierta = null;
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