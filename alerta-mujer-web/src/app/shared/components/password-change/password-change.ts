import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PasswordService, evaluatePassword } from '../../../core/services/password.service';
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
  readonly close = output<void>();

  current = signal('');
  newOne = signal('');
  confirm = signal('');
  show = signal({ current: false, newPassword: false, confirm: false });
  sending = signal(false);
  error = signal<string | null>(null);
  ready = signal(false);

  readonly evaluation = computed(() => evaluatePassword(this.newOne()));
  readonly match = computed(() => this.confirm().length > 0 && this.confirm() === this.newOne());
  readonly canSave = computed(
    () => !!this.current() && this.evaluation().valid && this.match() && this.newOne() !== this.current() && !this.sending(),
  );

  toggle(field: 'current' | 'newPassword' | 'confirm'): void {
    this.show.update((v) => ({ ...v, [field]: !v[field] }));
  }

  save(): void {
    if (!this.canSave()) return;
    this.sending.set(true);
    this.error.set(null);
    this.service.change(this.current(), this.newOne()).subscribe({
      next: () => {
        this.sending.set(false);
        this.ready.set(true);
      },
      error: (e) => {
        this.sending.set(false);
        this.error.set(e?.error?.message ?? 'No se pudo cambiar la contraseña. Intenta de nuevo.');
      },
    });
  }
}
