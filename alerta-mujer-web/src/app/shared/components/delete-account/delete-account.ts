import { TPipe } from '../../../core/i18n/i18n';
import { Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';

/** Word that must be typed to confirm (the same one the backend requires). */
const CONFIRMATION = 'ELIMINAR';

/**
 * Window for the user to delete her account: explains what is erased and asks to type ELIMINAR.
 * When done it signs out (the backend already revoked all sessions).
 */
@Component({
  selector: 'app-delete-account',
  standalone: true,
  imports: [TPipe, FormsModule],
  templateUrl: './delete-account.html',
  styleUrls: ['../password-change/password-change.scss', './delete-account.scss'],
})
export class DeleteAccountComponent {
  @Output() close = new EventEmitter<void>();

  private http = inject(HttpClient);
  private auth = inject(AuthService);

  readonly word = CONFIRMATION;
  readonly text = signal('');
  readonly deleting = signal(false);
  readonly error = signal('');
  readonly ready = computed(() => this.text().trim().toUpperCase() === CONFIRMATION);

  readonly whatGetsDeleted = [
    'Tu nombre, correo, teléfono, documento y foto',
    'Tus contactos de emergencia',
    'Tus ubicaciones, recorridos y lugares guardados',
    'Los videos, audios y fotos de tus alertas',
  ];

  exit(): void {
    if (!this.deleting()) this.close.emit();
  }

  delete(): void {
    if (!this.ready() || this.deleting()) return;
    this.deleting.set(true);
    this.error.set('');
    this.http.delete<void>(`${environment.apiUrl}/api/users/me`, { body: { confirmation: CONFIRMATION } }).subscribe({
      next: () => this.auth.logout(),
      error: () => {
        this.deleting.set(false);
        this.error.set('No se pudo eliminar la cuenta. Revisa tu conexión e inténtalo de nuevo.');
      },
    });
  }
}
