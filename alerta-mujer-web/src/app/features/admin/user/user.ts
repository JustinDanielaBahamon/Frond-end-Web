import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { AdminPhone, AlertSummary, ModerationHistory, UsersService } from '../../../core/services/users.services';
import { shrinkPhoto } from '../../../core/utils/photo';
import { ManagedUser } from '../../../core/models/user.model';
import { Chip } from '../../../shared/components/chip/chip';
import { Modal } from '../../../shared/components/modal/modal';
import { compactPages } from '../../../shared/utils/pagination';

// We extend the real model only with the UI selection flag (it does not live in the API)
type UserUI = ManagedUser & { selected?: boolean };

/** Reasons to block an account (they stay in the moderation case). */
export const BLOCK_REASONS = [
  'Falsas alarmas reiteradas',
  'Fraude o suplantación de identidad',
  'Acoso o amenazas',
  'Uso indebido de la plataforma',
  'Solicitud de las autoridades',
  'Otro',
];

const PERMISSION_LABELS: Record<string, string> = {
  ubicacion: 'Ubicación', notificaciones: 'Notificaciones', agitar: 'Agitar para alertar', bateria: 'Batería sin restricciones',
  pantallaCompleta: 'Pantalla completa', microfono: 'Micrófono', camara: 'Cámara',
};

const HISTORY_TYPE: Record<string, string> = {
  block: 'Cuenta bloqueada', unblock: 'Cuenta desbloqueada', deletion_pending: 'Eliminación solicitada',
  deletion_approved: 'Cuenta eliminada', deletion_rejected: 'Eliminación rechazada',
};

interface ChipData {
  label: string;
  value: string;
  color: string;
  count: number;
}

// Data that comes from other db.json tables
export interface EmergencyContact {
  id: string;
  user_profile_id: number | string;
  contact_name: string;
  telephone: string;
  relationship: string;
}


// Modelo del formulario (crear / editar)
interface UserForm {
  first_name: string;
  last_name: string;
  email: string;
  telephone: string;
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

  loading = true;

  private allUsers: UserUI[] = [];

  // ── Estado UI ────────────────────────────────────────────────
  filteredUsers: UserUI[] = [];
  searchTerm = '';
  statusFilter = 'Todos';

  currentPage = 1;
  readonly perPage = 6;
  totalFiltered = 0;
  totalPageCount = 1;
  pages: (number | null)[] = [];

  selectedCount = 0;
  allSelected = false;

  // ── Modales ──────────────────────────────────────────────────
  detailModal = false;
  blockModal = false;
  modalForm = false;
  selectedUser: UserUI | null = null;
  blockAction: 'bloquear' | 'desbloquear' = 'bloquear';
  readonly blockReasons = BLOCK_REASONS;
  /** One or several (bulk block) users of the block modal. */
  usersToBlock: UserUI[] = [];
  blockReason = '';
  blockDescription = '';
  blockEvidence: string | null = null;
  blockError = '';
  savingBlock = false;

  // Detail: phones, permissions and moderation history
  phoneDetails: AdminPhone[] = [];
  historyDetail: ModerationHistory[] = [];
  openEvidence: string | null = null;

  // Deletion (approved by another admin)
  deleteModal = false;
  deleteReason = '';
  deleteError = '';
  savingDelete = false;

  notice = '';

  // ── Detalle (datos reales de otras tablas) ───────────────────
  alertDetails: AlertSummary[] = [];
  loadingDetail = false;

  // ── Formulario ───────────────────────────────────────────────
  formMode: 'editar' = 'editar';
  saving = false;
  errorForm = '';
  form: UserForm = this.emptyForm();

  Math = Math;

  // ── Chips ────────────────────────────────────────────────────
  get chips(): ChipData[] {
    return [
      { label: 'Todas',                 value: 'Todos',                color: '#7c3aed', count: this.allUsers.length },
      { label: 'Activas',               value: 'Activa',               color: '#7c3aed', count: this.count('Activa') },
      { label: 'Inactivas',             value: 'Inactiva',             color: '#9333ea', count: this.count('Inactiva') },
      { label: 'Bloqueadas por Fraude', value: 'Bloqueada por Fraude', color: '#c026d3', count: this.count('Bloqueada por Fraude') },
    ];
  }

  private count(status: string): number {
    return this.allUsers.filter(u => u.status === status).length;
  }

  // ── Stat cards ───────────────────────────────────────────────
  get totalUsers()      { return this.allUsers.length; }
  get activeUsers()    { return this.count('Activa'); }
  get blockedUsers() { return this.count('Bloqueada por Fraude'); }
  get inactiveUsers()  { return this.count('Inactiva'); }

  // ── Lifecycle ────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadUsers();
  }

  private loadUsers(): void {
    this.loading = true;

    // The DTO already carries the alert count computed by the backend
    this.usersService.getAll().subscribe({
      next: (users) => {
        this.allUsers = users;
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando usuarias:', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Filters and pagination ─────────────────────────────────────
  applyFilters(): void {
    let result = [...this.allUsers];

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(u =>
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.telephone.includes(term)
      );
    }

    if (this.statusFilter !== 'Todos') {
      result = result.filter(u => u.status === this.statusFilter);
    }

    this.totalFiltered = result.length;
    this.totalPageCount = Math.ceil(this.totalFiltered / this.perPage) || 1;
    if (this.currentPage > this.totalPageCount) this.currentPage = 1;

    const start = (this.currentPage - 1) * this.perPage;
    this.filteredUsers = result.slice(start, start + this.perPage);
    this.pages = compactPages(this.currentPage, this.totalPageCount);
    this.updateSelection();
  }

  changePage(p: number): void {
    if (p < 1 || p > this.totalPageCount) return;
    this.currentPage = p;
    this.applyFilters();
  }

  setChip(value: string): void {
    this.statusFilter = value;
    this.currentPage = 1;
    this.applyFilters();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilters();
  }

  clearAll(): void {
    this.searchTerm = '';
    this.statusFilter = 'Todos';
    this.applyFilters();
  }

  // ── Selection ────────────────────────────────────────────────
  toggleAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.filteredUsers.forEach(u => u.selected = checked);
    this.updateSelection();
  }

  updateSelection(): void {
    this.selectedCount = this.filteredUsers.filter(u => u.selected).length;
    this.allSelected = this.selectedCount === this.filteredUsers.length && this.filteredUsers.length > 0;
  }

  deselectAll(): void {
    this.filteredUsers.forEach(u => u.selected = false);
    this.updateSelection();
  }

  // ── Bulk block through the API ────────────────────────────────────
  blockSelected(): void {
    const selected = this.filteredUsers.filter(u => u.selected && u.status !== 'Bloqueada por Fraude');
    if (selected.length === 0) return;
    this.openBlock(selected, 'bloquear');
  }

  // ── View detail: loads the real latest alerts ────────────
  viewDetail(u: UserUI): void {
    this.selectedUser = u;
    this.alertDetails = [];
    this.phoneDetails = [];
    this.historyDetail = [];
    this.loadingDetail = true;
    this.detailModal = true;
    this.usersService.phones().subscribe({
      next: (list) => {
        this.phoneDetails = list.filter(c => String(c.userId) === String(u.id) && c.osName !== 'web');
        this.cdr.detectChanges();
      },
      error: () => {},
    });
    this.usersService.history(u.id).subscribe({
      next: (h) => {
        this.historyDetail = h;
        this.cdr.detectChanges();
      },
      error: () => {},
    });

    // GET /api/alerts/user/{usersId} acepta users.id para admin
    this.usersService.getAlertsByUser(u.id).subscribe({
      next: (alerts) => {
        // Newest first, at most 5
        this.alertDetails = [...alerts]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 5);
        this.loadingDetail = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando detalle:', err);
        this.loadingDetail = false;
        this.cdr.detectChanges();
      }
    });
  }

  /** Only the user changes the password: she is sent the email with the code. */
  resetPassword(u: UserUI): void {
    this.usersService.sendRecovery(u.email).subscribe({
      next: () => this.showNotice(`Enviamos a ${u.email} un código para que cree una contraseña nueva.`),
      error: () => this.showNotice('No se pudo enviar el correo de recuperación. Intenta de nuevo.'),
    });
  }

  toggleBlock(u: UserUI): void {
    this.openBlock([u], u.status === 'Bloqueada por Fraude' ? 'desbloquear' : 'bloquear');
  }

  private openBlock(users: UserUI[], action: 'bloquear' | 'desbloquear'): void {
    this.usersToBlock = users;
    this.selectedUser = users[0];
    this.blockAction = action;
    this.blockReason = '';
    this.blockDescription = '';
    this.blockEvidence = null;
    this.blockError = '';
    this.detailModal = false;
    this.blockModal = true;
  }

  async chooseEvidence(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      // Readable but light screenshot (the server accepts up to ~300 KB)
      this.blockEvidence = await shrinkPhoto(file, 1100);
      this.blockError = '';
    } catch (e) {
      this.blockError = e instanceof Error ? e.message : 'No se pudo usar la imagen';
    }
    this.cdr.detectChanges();
  }

  get blockValid(): boolean {
    const note = this.blockDescription.trim().length >= 10;
    return this.blockAction === 'desbloquear' ? note : note && !!this.blockReason;
  }

  confirmBlock(): void {
    if (!this.blockValid || this.savingBlock) return;
    this.savingBlock = true;
    this.blockError = '';
    const description = this.blockDescription.trim();
    const requests = this.usersToBlock.map(u => this.blockAction === 'bloquear'
      ? this.usersService.block(u.id, this.blockReason, description, this.blockEvidence)
      : this.usersService.unblock(u.id, description));
    forkJoin(requests).subscribe({
      next: () => {
        const n = this.usersToBlock.length;
        this.showNotice(this.blockAction === 'bloquear'
          ? `${n === 1 ? 'Cuenta bloqueada' : n + ' cuentas bloqueadas'}. El caso quedó registrado en Moderación.`
          : 'Cuenta desbloqueada.');
        this.savingBlock = false;
        this.deselectAll();
        this.closeModals();
        this.loadUsers();
      },
      error: (err) => {
        this.savingBlock = false;
        this.blockError = err?.error?.message ?? 'No se pudo completar. Intenta de nuevo.';
        this.cdr.detectChanges();
      },
    });
  }

  viewEvidence(item: ModerationHistory): void {
    if (!item.caseId) return;
    this.usersService.caseEvidenceOf(item.caseId).subscribe({
      next: (e) => {
        this.openEvidence = e;
        this.cdr.detectChanges();
      },
    });
  }

  // ── Eliminar cuenta (la aprueba otra administradora) ─────────
  openDelete(u: UserUI): void {
    this.selectedUser = u;
    this.deleteReason = '';
    this.deleteError = '';
    this.detailModal = false;
    this.deleteModal = true;
  }

  requestDeletion(): void {
    const u = this.selectedUser;
    if (!u || this.deleteReason.trim().length < 10 || this.savingDelete) return;
    this.savingDelete = true;
    this.usersService.requestDeletion(u.id, this.deleteReason.trim()).subscribe({
      next: () => {
        this.savingDelete = false;
        this.closeModals();
        this.showNotice('Solicitud enviada. Otra administradora debe aprobarla en Moderación.');
      },
      error: (err) => {
        this.savingDelete = false;
        this.deleteError = err?.error?.message ?? 'No se pudo enviar la solicitud.';
        this.cdr.detectChanges();
      },
    });
  }

  // ── Ayudas del detalle ───────────────────────────────────────
  permissionsOf(c: AdminPhone): { name: string; ok: boolean }[] {
    if (!c.permissions) return [];
    try {
      const data = JSON.parse(c.permissions) as Record<string, boolean>;
      return Object.entries(data).map(([k, v]) => ({ name: PERMISSION_LABELS[k] ?? k, ok: v === true }));
    } catch {
      return [];
    }
  }

  phoneName(c: AdminPhone): string {
    return c.deviceName || [c.brand, c.model].filter(Boolean).join(' ') || 'Celular';
  }

  historyType(t: string): string {
    return HISTORY_TYPE[t] ?? t;
  }

  private showNotice(text: string): void {
    this.notice = text;
    this.cdr.detectChanges();
    setTimeout(() => {
      if (this.notice === text) {
        this.notice = '';
        this.cdr.detectChanges();
      }
    }, 5000);
  }

  // ── Formulario crear / editar ────────────────────────────────
  private emptyForm(): UserForm {
    return { first_name: '', last_name: '', email: '', telephone: '' };
  }

  openEditModal(u: UserUI): void {
    this.formMode = 'editar';
    this.selectedUser = u;
    this.form = {
      first_name: u.first_name ?? u.name.split(' ')[0],
      last_name: u.last_name ?? '',
      email: u.email,
      telephone: u.telephone,
    };
    this.errorForm = '';
    this.detailModal = false;
    this.modalForm = true;
  }

  saveUser(): void {
    this.errorForm = '';

    const email = this.form.email.trim().toLowerCase();
    const duplicate = this.allUsers.some(u =>
      u.email.toLowerCase() === email &&
      u.id !== this.selectedUser?.id
    );
    if (duplicate) {
      this.errorForm = 'Ya existe una usuaria con ese correo.';
      return;
    }

    this.saving = true;

    {
      const u = this.selectedUser!;
      const changes: Partial<ManagedUser> & Record<string, unknown> = {
        name: `${this.form.first_name.trim()} ${this.form.last_name.trim()}`.trim(),
        first_name: this.form.first_name.trim(),
        last_name: this.form.last_name.trim(),
        email,
        telephone: this.form.telephone.trim(),
      };

      this.usersService.updateUser(u.id, changes).subscribe({
        next: (updated) => {
          this.allUsers = this.allUsers.map(x =>
            x.id === updated.id ? { ...x, ...updated, alerts: x.alerts } : x
          );
          this.finishSaving();
        },
        error: (err) => this.handleSaveError(err),
      });
    }
  }

  private finishSaving(): void {
    this.saving = false;
    this.closeModals();
    this.applyFilters();
    this.cdr.detectChanges();
  }

  private handleSaveError(err: unknown): void {
    console.error('Error guardando usuaria:', err);
    this.saving = false;
    this.errorForm = 'No se pudo guardar. Intenta de nuevo.';
    this.cdr.detectChanges();
  }

  closeModals(): void {
    this.detailModal = false;
    this.blockModal = false;
    this.modalForm = false;
    this.deleteModal = false;
    this.openEvidence = null;
    this.selectedUser = null;
    this.errorForm = '';
  }

  // ── Helpers de estilo ────────────────────────────────────────
  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      'Activa':               'estado--activa',
      'Inactiva':             'estado--inactiva',
      'Bloqueada por Fraude': 'estado--bloqueada',
    };
    return map[status] ?? '';
  }
}