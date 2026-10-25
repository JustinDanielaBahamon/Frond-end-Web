import { Component, ViewEncapsulation, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CardComponent } from '../../../shared/components/card/card';
import { PasswordService } from '../../../core/services/password.service';
import { RecoveryStateService } from '../../../core/services/recovery-state.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterModule, CardComponent],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
  encapsulation: ViewEncapsulation.None
})
export class ForgotPasswordComponent {
  private router = inject(Router);
  private passwordService = inject(PasswordService);
  private status = inject(RecoveryStateService);

  email = signal(this.status.email() ?? '');
  validEmail = signal(true);
  sending = signal(false);
  error = signal<string | null>(null);

  backToLogin() {
    this.router.navigate(['/auth/login']);
  }

  validateEmail() {
    const value = this.email().trim();
    this.validEmail.set(!value || /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/.test(value));
  }

  sendEmail() {
    this.validateEmail();
    const email = this.email().trim();
    if (!email || !this.validEmail() || this.sending()) return;

    this.sending.set(true);
    this.error.set(null);
    this.passwordService.requestCode(email).subscribe({
      next: () => {
        this.sending.set(false);
        this.status.email.set(email);
        this.status.code.set(null);
        this.router.navigate(['/auth/verify-code']);
      },
      error: (e) => {
        this.sending.set(false);
        this.error.set(e?.status === 429
          ? 'Hiciste muchos intentos. Espera un minuto e inténtalo de nuevo.'
          : 'No pudimos enviar el código. Revisa tu conexión e inténtalo de nuevo.');
      },
    });
  }
}
