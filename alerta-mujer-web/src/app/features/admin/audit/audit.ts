import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AuditService, FiltrosAuditoria, RegistroAuditoria, ResponsableAuditoria
} from '../../../core/services/audit.service';
import { SelectorFecha } from '../../../shared/components/selector-fecha/selector-fecha';

const POR_PAGINA = 10;

/** Nombres legibles de los tipos de registro auditados. */
export const TIPOS: Record<string, string> = {
  SESSION: 'Sesión',
  SYSTEM_CONFIGURATION: 'Parámetros del sistema',
  ACCOUNT: 'Cuenta',
  USER: 'Usuaria',
  ALERT: 'Alerta',
  EVIDENCE: 'Evidencia',
  EMERGENCY_CONTACT: 'Contacto de emergencia',
  ADMIN_PROFILE: 'Perfil de administración',
  ROLE: 'Rol',
};

const ACCIONES: Record<string, string> = {
  LOGIN_SUCCESS: 'Inició sesión',
  LOGIN_FAILED: 'Intento de inicio fallido',
  LOGOUT: 'Cerró sesión',
  PASSWORD_CHANGED: 'Cambió su contraseña',
  INSERT: 'Creó',
  UPDATE: 'Modificó',
  DELETE: 'Eliminó',
};

// Columnas que aparecen en el detalle, con su nombre para el panel
const CAMPOS: Record<string, string> = {
  status: 'estado',
  ended_at: 'fin',
  cancelled_at: 'cancelación',
  password_hash: 'contraseña',
  review_status: 'revisión',
  first_name: 'nombre',
  last_name: 'apellido',
  telephone: 'teléfono',
  email: 'correo',
  role_id: 'rol',
  document_number: 'documento',
  sos_max_duration_minutes: 'Duración máxima de alerta (min)',
  emergency_phone_number: 'Número de emergencia',
  admin_email: 'Correo de soporte',
  max_emergency_contacts: 'Contactos por usuaria',
  min_app_version: 'Versión mínima de la app',
  notifications_enabled: 'Notificaciones',
  default_theme: 'Tema por defecto',
  updated_by_admin_id: 'responsable del cambio',
};

@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [SelectorFecha, CommonModule, FormsModule],
  templateUrl: './audit.html',
  styleUrl: './audit.scss',
})
export class AuditComponent implements OnInit {
  private auditService = inject(AuditService);

  readonly tipos = Object.entries(TIPOS).map(([valor, etiqueta]) => ({ valor, etiqueta }));
  readonly acciones = Object.entries(ACCIONES).map(([valor, etiqueta]) => ({ valor, etiqueta }));

  filtros: FiltrosAuditoria = { responsableId: null, tipo: '', accion: '', desde: '', hasta: '' };
  readonly responsables = signal<ResponsableAuditoria[]>([]);

  readonly registros = signal<RegistroAuditoria[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(0);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly exportando = signal(false);
  readonly seleccionado = signal<RegistroAuditoria | null>(null);

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / POR_PAGINA)));
  readonly paginas = computed(() => {
    // Ventana de 5 páginas alrededor de la actual
    const total = this.totalPaginas();
    const actual = this.pagina() + 1;
    let inicio = Math.max(1, actual - 2);
    const fin = Math.min(total, inicio + 4);
    inicio = Math.max(1, fin - 4);
    return Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i);
  });
  readonly desdeItem = computed(() => (this.total() === 0 ? 0 : this.pagina() * POR_PAGINA + 1));
  readonly hastaItem = computed(() => Math.min((this.pagina() + 1) * POR_PAGINA, this.total()));

  ngOnInit(): void {
    this.auditService.responsables().subscribe({ next: (r) => this.responsables.set(r) });
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.auditService.listar(this.filtros, this.pagina(), POR_PAGINA).subscribe({
      next: (p) => {
        this.registros.set(p.registros);
        this.total.set(p.total);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la auditoría');
        this.cargando.set(false);
      },
    });
  }

  aplicarFiltros(): void {
    this.pagina.set(0);
    this.cargar();
  }

  limpiarFiltros(): void {
    this.filtros = { responsableId: null, tipo: '', accion: '', desde: '', hasta: '' };
    this.aplicarFiltros();
  }

  verSesiones(): void {
    this.filtros = { ...this.filtros, tipo: 'SESSION', accion: '' };
    this.aplicarFiltros();
  }

  verIntentosFallidos(): void {
    this.filtros = { ...this.filtros, tipo: 'SESSION', accion: 'LOGIN_FAILED' };
    this.aplicarFiltros();
  }

  irAPagina(n: number): void {
    if (n < 1 || n > this.totalPaginas()) return;
    this.pagina.set(n - 1);
    this.cargar();
  }

  exportar(): void {
    this.exportando.set(true);
    this.auditService.exportar(this.filtros).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.exportando.set(false);
      },
      error: () => {
        this.error.set('No se pudo exportar la auditoría');
        this.exportando.set(false);
      },
    });
  }

  // ── Presentación ─────────────────────────────────────────────
  accion(r: RegistroAuditoria): string {
    return ACCIONES[r.accion] ?? r.accion;
  }

  tipo(r: RegistroAuditoria): string {
    return TIPOS[r.tipo] ?? r.tipo;
  }

  objeto(r: RegistroAuditoria): string {
    if (r.tipo === 'SESSION') return 'Panel de administración';
    return `${this.tipo(r)}${r.registroId != null ? ' #' + r.registroId : ''}`;
  }

  /** Quién hizo el cambio cuando no hubo una persona con sesión. */
  sinResponsable(r: RegistroAuditoria): { texto: string; ayuda: string; icono: string } {
    if (r.origen?.startsWith('Tarea automática')) {
      return { texto: r.origen.replace('Tarea automática · ', ''), ayuda: 'Proceso automático del servidor', icono: 'fa-gears' };
    }
    if (r.origen) {
      return { texto: 'Sin sesión', ayuda: 'Petición sin usuario autenticado (' + r.origen + ')', icono: 'fa-user-slash' };
    }
    return {
      texto: 'No registrado',
      ayuda: 'Registro anterior al seguimiento de responsables, o cambio hecho directamente en la base de datos',
      icono: 'fa-circle-question',
    };
  }

  iconoOrigen(origen: string | null): string {
    if (!origen) return 'fa-circle-question';
    if (origen.startsWith('App móvil')) return 'fa-mobile-screen';
    if (origen.startsWith('Panel web')) return 'fa-desktop';
    if (origen.startsWith('Tarea automática')) return 'fa-gears';
    return 'fa-plug';
  }

  claseAccion(r: RegistroAuditoria): string {
    if (r.accion === 'LOGIN_FAILED' || r.accion === 'DELETE') return 'badge--danger';
    if (r.accion === 'LOGIN_SUCCESS' || r.accion === 'INSERT') return 'badge--ok';
    if (r.accion === 'LOGOUT') return 'badge--muted';
    return 'badge--info';
  }

  /** "lunes, 20 de octubre de 2026, 10:32:15 a. m." (la app no registra el locale de Angular). */
  fechaLarga(fecha: Date | string | null): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? '' : d.toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'medium' });
  }

  /** Ícono del tipo de acción (cabecera del detalle). */
  iconoAccion(r: RegistroAuditoria): string {
    const iconos: Record<string, string> = {
      INSERT: 'fa-plus', UPDATE: 'fa-pen', DELETE: 'fa-trash',
      LOGIN_SUCCESS: 'fa-right-to-bracket', LOGIN_FAILED: 'fa-triangle-exclamation', LOGOUT: 'fa-right-from-bracket',
    };
    return iconos[r.accion] ?? 'fa-clipboard-list';
  }

  /** Cambios como filas "dato / antes / después"; si el registro no los trae, antes y después son null. */
  cambios(r: RegistroAuditoria): { campo: string; antes: string | null; despues: string | null }[] {
    return this.detalle(r).map((linea) => {
      const flecha = linea.indexOf(' → ');
      const dosPuntos = linea.indexOf(': ');
      if (flecha < 0 || dosPuntos < 0 || dosPuntos > flecha) return { campo: linea, antes: null, despues: null };
      return {
        campo: linea.slice(0, dosPuntos),
        antes: linea.slice(dosPuntos + 2, flecha),
        despues: linea.slice(flecha + 3),
      };
    });
  }

  /** Detalle legible: valores "antes → después", columnas cambiadas o el dispositivo de la sesión. */
  detalle(r: RegistroAuditoria): string[] {
    const d = r.descripcion;
    if (d.startsWith('Valores: ')) {
      return d.slice(9).split('; ').map((cambio) => {
        const i = cambio.indexOf(': ');
        const campo = cambio.slice(0, i);
        return `${CAMPOS[campo] ?? campo}: ${cambio.slice(i + 2)}`;
      });
    }
    if (d.startsWith('Columnas modificadas: ')) {
      return ['Cambió ' + d.slice(22).split(', ').map((c) => CAMPOS[c] ?? c.replace(/_/g, ' ')).join(', ')];
    }
    return d ? [d] : [];
  }

  verDetalle(r: RegistroAuditoria): void {
    this.seleccionado.set(r);
  }

  cerrarDetalle(): void {
    this.seleccionado.set(null);
  }
}
