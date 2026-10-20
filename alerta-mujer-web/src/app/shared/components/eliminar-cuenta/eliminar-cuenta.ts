import { Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';

/** Palabra que hay que escribir para confirmar (la misma que exige el backend). */
const CONFIRMACION = 'ELIMINAR';

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
export class EliminarCuentaComponent {
  @Output() cerrar = new EventEmitter<void>();

  private http = inject(HttpClient);
  private auth = inject(AuthService);

  readonly palabra = CONFIRMACION;
  readonly texto = signal('');
  readonly eliminando = signal(false);
  readonly error = signal('');
  readonly listo = computed(() => this.texto().trim().toUpperCase() === CONFIRMACION);

  readonly queSeBorra = [
    'Tu nombre, correo, teléfono, documento y foto',
    'Tus contactos de emergencia',
    'Tus ubicaciones, recorridos y lugares guardados',
    'Los videos, audios y fotos de tus alertas',
  ];

  salir(): void {
    if (!this.eliminando()) this.cerrar.emit();
  }

  eliminar(): void {
    if (!this.listo() || this.eliminando()) return;
    this.eliminando.set(true);
    this.error.set('');
    this.http.delete<void>(`${environment.apiUrl}/api/users/me`, { body: { confirmation: CONFIRMACION } }).subscribe({
      next: () => this.auth.logout(),
      error: () => {
        this.eliminando.set(false);
        this.error.set('No se pudo eliminar la cuenta. Revisa tu conexión e inténtalo de nuevo.');
      },
    });
  }
}
