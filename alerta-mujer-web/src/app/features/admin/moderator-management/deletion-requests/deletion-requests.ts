import { TPipe } from '../../../../core/i18n/i18n';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeletionRequest, UsersService } from '../../../../core/services/users.services';
import { AuthService } from '../../../../core/auth/auth.service';

/**
 * Requests to delete accounts (requested from User management). Deleting erases the personal
 * data and cannot be undone, so an admin other than the requester approves it.
 */
@Component({
  selector: 'app-deletion-requests',
  standalone: true,
  imports: [TPipe, CommonModule, FormsModule],
  templateUrl: './deletion-requests.html',
  styleUrl: './deletion-requests.scss',
})
export class DeletionRequests implements OnInit {
  private usersService = inject(UsersService);
  private cdr = inject(ChangeDetectorRef);
  private miId = inject(AuthService).getCurrentUser()?.id ?? null;

  requests: DeletionRequest[] = [];
  decisionNote: Record<number, string> = {};
  requestError = '';

  get pendingRequests(): DeletionRequest[] {
    return this.requests.filter(s => s.status === 'pending');
  }

  get decidedRequests(): DeletionRequest[] {
    return this.requests.filter(s => s.status !== 'pending').slice(0, 5);
  }

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    this.usersService.deletionRequests().subscribe({
      next: (list) => {
        this.requests = list;
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  isMine(s: DeletionRequest): boolean {
    return this.miId != null && String(s.requestedBy) === String(this.miId);
  }

  decide(s: DeletionRequest, approve: boolean): void {
    if (approve && !confirm(`¿Eliminar la cuenta de ${s.userName ?? 'esta usuaria'}? Sus datos personales se borran y no se puede deshacer.`)) return;
    this.requestError = '';
    this.usersService.decideDeletion(s.id, approve, this.decisionNote[s.id] ?? '').subscribe({
      next: () => this.loadRequests(),
      error: (err) => {
        this.requestError = err?.error?.message ?? 'No se pudo registrar la decisión.';
        this.cdr.detectChanges();
      },
    });
  }
}
