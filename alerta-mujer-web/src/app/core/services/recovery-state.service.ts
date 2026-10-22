import { Injectable, signal } from '@angular/core';

/**
 * Datos del flujo "olvidé mi contraseña" entre pantallas (correo → código → nueva contraseña).
 * Solo en memoria: si se recarga la página se vuelve a empezar.
 */
@Injectable({ providedIn: 'root' })
export class RecoveryStateService {
  readonly email = signal<string | null>(null);
  readonly code = signal<string | null>(null);

  clear(): void {
    this.email.set(null);
    this.code.set(null);
  }
}
