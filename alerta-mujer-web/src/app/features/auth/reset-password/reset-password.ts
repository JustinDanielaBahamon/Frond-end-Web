import { TPipe } from '../../../core/i18n/i18n';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardComponent } from '../../../shared/components/card/card';
import { PasswordStrengthComponent } from '../../../shared/components/password-strength/password-strength';
import { PasswordService, evaluatePassword } from '../../../core/services/password.service';
import { RecoveryStateService } from '../../../core/services/recovery-state.service';

/** Last step of "forgot my password": the new password with the already verified code. */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [TPipe, FormsModule, CardComponent, PasswordStrengthComponent],
  templateUrl: './reset-password.html',
  styleUrls: ['../verify-code/verify-code.scss', './reset-password.scss'],
})
export class ResetPasswordComponent implements OnInit {
  private router = inject(Router);
  private passwordService = inject(PasswordService);
  private status = inject(RecoveryStateService);

  readonly email = this.status.email;
  newOne = signal('');
  confirm = signal('');
  viewNew = signal(false);
  showConfirm = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  ready = signal(false);

  readonly match = computed(() => this.confirm().length > 0 && this.confirm() === this.newOne());
  readonly canSave = computed(() => evaluatePassword(this.newOne()).valid && this.match() && !this.saving());

  ngOnInit(): void {
    if (!this.status.email() || !this.status.code()) {
      this.router.navigate(['/auth/forgot-password']);
    }
  }

  save(): void {
    const email = this.status.email();
    const code = this.status.code();
    if (!email || !code || !this.canSave()) return;
    this.saving.set(true);
    this.error.set(null);
    this.passwordService.reset(email, code, this.newOne()).subscribe({
      next: () => {
        this.saving.set(false);
        this.ready.set(true);
        this.status.clear();
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(e?.error?.message ?? 'No se pudo guardar la contraseña. Pide un código nuevo.');
      },
    });
  }

  irALogin(): void {
    this.router.navigate(['/auth/login']);
  }
}
