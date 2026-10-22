import { Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';

/** Palabra que hay que escribir para confirmar (la misma que exige el backend). */
const CONFIRMATION = 'ELIMINAR';

/**
 * Ventana para que la usuaria elimine su cuenta: explica qué se borra y pide escribir ELIMINAR.
 * Al terminar cierra la sesión (el backend ya revocó todas las sesiones).
 */
@Component({
  selector: 'app-eliminar-cuenta',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './eliminar-cuenta.html',
  styleUrls: ['../password-change/password-change.scss', './eliminar-cuenta.scss'],
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
