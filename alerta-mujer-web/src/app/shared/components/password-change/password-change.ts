import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PasswordService, evaluarContrasena } from '../../../core/services/password.service';
import { PasswordStrengthComponent } from '../password-strength/password-strength';

/** Ventana para cambiar la contraseña de la cuenta en sesión (pide la actual). */
@Component({
  selector: 'app-password-change',
  standalone: true,
  imports: [FormsModule, PasswordStrengthComponent],
  templateUrl: './password-change.html',
  styleUrl: './password-change.scss',
})
export class PasswordChangeComponent {
  private service = inject(PasswordService);
  readonly cerrar = output<void>();

  actual = signal('');
  nueva = signal('');
  confirmar = signal('');
  ver = signal({ actual: false, nueva: false, confirmar: false });
  enviando = signal(false);
  error = signal<string | null>(null);
  listo = signal(false);

  readonly evaluacion = computed(() => evaluarContrasena(this.nueva()));
  readonly coinciden = computed(() => this.confirmar().length > 0 && this.confirmar() === this.nueva());
  readonly puedeGuardar = computed(
    () => !!this.actual() && this.evaluacion().valida && this.coinciden() && this.nueva() !== this.actual() && !this.enviando(),
  );

  alternar(campo: 'actual' | 'nueva' | 'confirmar'): void {
    this.ver.update((v) => ({ ...v, [campo]: !v[campo] }));
  }

  guardar(): void {
    if (!this.puedeGuardar()) return;
    this.enviando.set(true);
    this.error.set(null);
    this.service.cambiar(this.actual(), this.nueva()).subscribe({
      next: () => {
        this.enviando.set(false);
        this.listo.set(true);
      },
      error: (e) => {
        this.enviando.set(false);
        this.error.set(e?.error?.message ?? 'No se pudo cambiar la contraseña. Intenta de nuevo.');
      },
    });
  }
}
