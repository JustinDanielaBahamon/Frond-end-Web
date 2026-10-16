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
  private estado = inject(RecoveryStateService);

  email = signal(this.estado.email() ?? '');
  emailValido = signal(true);
  enviando = signal(false);
  error = signal<string | null>(null);

  volverLogin() {
    this.router.navigate(['/auth/login']);
  }

  validarCorreo() {
    const valor = this.email().trim();
    this.emailValido.set(!valor || /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/.test(valor));
  }

  enviarCorreo() {
    this.validarCorreo();
    const email = this.email().trim();
    if (!email || !this.emailValido() || this.enviando()) return;

    this.enviando.set(true);
    this.error.set(null);
    this.passwordService.pedirCodigo(email).subscribe({
      next: () => {
        this.enviando.set(false);
        this.estado.email.set(email);
        this.estado.codigo.set(null);
        this.router.navigate(['/auth/verify-code']);
      },
      error: (e) => {
        this.enviando.set(false);
        this.error.set(e?.status === 429
          ? 'Hiciste muchos intentos. Espera un minuto e inténtalo de nuevo.'
          : 'No pudimos enviar el código. Revisa tu conexión e inténtalo de nuevo.');
      },
    });
  }
}
