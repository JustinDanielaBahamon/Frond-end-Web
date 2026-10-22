import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AuditService, AuditFilters, AuditRecord, AuditActor
} from '../../../core/services/audit.service';
import { DatePicker } from '../../../shared/components/selector-fecha/selector-fecha';
import { compactPages } from '../../../shared/utils/paginacion';

const PER_PAGE = 10;

/** Nombres legibles de los tipos de registro auditados. */
export const TYPES: Record<string, string> = {
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

const ACTIONS: Record<string, string> = {
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
  imports: [DatePicker, CommonModule, FormsModule],
  templateUrl: './audit.html',
  styleUrl: './audit.scss',
})
export class AuditComponent implements OnInit {
  private auditService = inject(AuditService);

  readonly types = Object.entries(TYPES).map(([value, label]) => ({ value, label }));
  readonly actions = Object.entries(ACTIONS).map(([value, label]) => ({ value, label }));

  filters: AuditFilters = { actorId: null, tipo: '', action: '', from: '', to: '' };
  readonly actors = signal<AuditActor[]>([]);

  readonly records = signal<AuditRecord[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly exporting = signal(false);
  readonly selected = signal<AuditRecord | null>(null);

  readonly totalPageCount = computed(() => Math.max(1, Math.ceil(this.total() / PER_PAGE)));
  readonly pages = computed(() => compactPages(this.page() + 1, this.totalPageCount()));
  readonly fromItem = computed(() => (this.total() === 0 ? 0 : this.page() * PER_PAGE + 1));
  readonly toItem = computed(() => Math.min((this.page() + 1) * PER_PAGE, this.total()));

  ngOnInit(): void {
    this.auditService.actors().subscribe({ next: (r) => this.actors.set(r) });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.auditService.list(this.filters, this.page(), PER_PAGE).subscribe({
      next: (p) => {
        this.records.set(p.records);
        this.total.set(p.total);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la auditoría');
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    this.page.set(0);
    this.load();
  }

  clearFilters(): void {
    this.filters = { actorId: null, tipo: '', action: '', from: '', to: '' };
    this.applyFilters();
  }

  viewSessions(): void {
    this.filters = { ...this.filters, tipo: 'SESSION', action: '' };
    this.applyFilters();
  }

  viewFailedAttempts(): void {
    this.filters = { ...this.filters, tipo: 'SESSION', action: 'LOGIN_FAILED' };
    this.applyFilters();
  }

  goToPage(n: number): void {
    if (n < 1 || n > this.totalPageCount()) return;
    this.page.set(n - 1);
    this.load();
  }

  export(): void {
    this.exporting.set(true);
    this.auditService.export(this.filters).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => {
        this.error.set('No se pudo exportar la auditoría');
        this.exporting.set(false);
      },
    });
  }

  // ── Presentación ─────────────────────────────────────────────
  action(r: AuditRecord): string {
    return ACTIONS[r.action] ?? r.action;
  }

  tipo(r: AuditRecord): string {
    return TYPES[r.tipo] ?? r.tipo;
  }

  object(r: AuditRecord): string {
    if (r.tipo === 'SESSION') return 'Panel de administración';
    return `${this.tipo(r)}${r.recordId != null ? ' #' + r.recordId : ''}`;
  }

  /** Quién hizo el cambio cuando no hubo una persona con sesión. */
  withoutActor(r: AuditRecord): { text: string; help: string; icon: string } {
    if (r.source?.startsWith('Tarea automática')) {
      return { text: r.source.replace('Tarea automática · ', ''), help: 'Proceso automático del servidor', icon: 'fa-gears' };
    }
    if (r.source) {
      return { text: 'Sin sesión', help: 'Petición sin usuario autenticado (' + r.source + ')', icon: 'fa-user-slash' };
    }
    return {
      text: 'No registrado',
      help: 'Registro anterior al seguimiento de responsables, o cambio hecho directamente en la base de datos',
      icon: 'fa-circle-question',
    };
  }

  sourceIcon(source: string | null): string {
    if (!source) return 'fa-circle-question';
    if (source.startsWith('App móvil')) return 'fa-mobile-screen';
    if (source.startsWith('Panel web')) return 'fa-desktop';
    if (source.startsWith('Tarea automática')) return 'fa-gears';
    return 'fa-plug';
  }

  actionClass(r: AuditRecord): string {
    if (r.action === 'LOGIN_FAILED' || r.action === 'DELETE') return 'badge--danger';
    if (r.action === 'LOGIN_SUCCESS' || r.action === 'INSERT') return 'badge--ok';
    if (r.action === 'LOGOUT') return 'badge--muted';
    return 'badge--info';
  }

  /** "lunes, 20 de octubre de 2026, 10:32:15 a. m." (la app no registra el locale de Angular). */
  longDate(fecha: Date | string | null): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? '' : d.toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'medium' });
  }

  /** Ícono del tipo de acción (cabecera del detalle). */
  actionIcon(r: AuditRecord): string {
    const icons: Record<string, string> = {
      INSERT: 'fa-plus', UPDATE: 'fa-pen', DELETE: 'fa-trash',
      LOGIN_SUCCESS: 'fa-right-to-bracket', LOGIN_FAILED: 'fa-triangle-exclamation', LOGOUT: 'fa-right-from-bracket',
    };
    return icons[r.action] ?? 'fa-clipboard-list';
  }

  /** Cambios como filas "dato / antes / después"; si el registro no los trae, antes y después son null. */
  changes(r: AuditRecord): { field: string; before: string | null; after: string | null }[] {
    return this.detail(r).map((line) => {
      const arrow = line.indexOf(' → ');
      const twoPoints = line.indexOf(': ');
      if (arrow < 0 || twoPoints < 0 || twoPoints > arrow) return { field: line, before: null, after: null };
      return {
        field: line.slice(0, twoPoints),
        before: line.slice(twoPoints + 2, arrow),
        after: line.slice(arrow + 3),
      };
    });
  }

  /** Detalle legible: valores "antes → después", columnas cambiadas o el dispositivo de la sesión. */
  detail(r: AuditRecord): string[] {
    const d = r.description;
    if (d.startsWith('Valores: ')) {
      return d.slice(9).split('; ').map((change) => {
        const i = change.indexOf(': ');
        const field = change.slice(0, i);
        return `${CAMPOS[field] ?? field}: ${change.slice(i + 2)}`;
      });
    }
    if (d.startsWith('Columnas modificadas: ')) {
      return ['Cambió ' + d.slice(22).split(', ').map((c) => CAMPOS[c] ?? c.replace(/_/g, ' ')).join(', ')];
    }
    return d ? [d] : [];
  }

  viewDetail(r: AuditRecord): void {
    this.selected.set(r);
  }

  closeDetail(): void {
    this.selected.set(null);
  }
}
