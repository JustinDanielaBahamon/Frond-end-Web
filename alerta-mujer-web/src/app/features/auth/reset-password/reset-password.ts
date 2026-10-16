import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardComponent } from '../../../shared/components/card/card';
import { PasswordStrengthComponent } from '../../../shared/components/password-strength/password-strength';
import { PasswordService, evaluarContrasena } from '../../../core/services/password.service';
import { RecoveryStateService } from '../../../core/services/recovery-state.service';

/** Último paso de "olvidé mi contraseña": la nueva contraseña con el código ya verificado. */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, CardComponent, PasswordStrengthComponent],
  templateUrl: './reset-password.html',
  styleUrls: ['../verify-code/verify-code.scss', './reset-password.scss'],
})
export class ResetPasswordComponent implements OnInit {
  private router = inject(Router);
  private passwordService = inject(PasswordService);
  private estado = inject(RecoveryStateService);

  readonly email = this.estado.email;
  nueva = signal('');
  confirmar = signal('');
  verNueva = signal(false);
  verConfirmar = signal(false);
  guardando = signal(false);
  error = signal<string | null>(null);
  listo = signal(false);

  readonly coinciden = computed(() => this.confirmar().length > 0 && this.confirmar() === this.nueva());
  readonly puedeGuardar = computed(() => evaluarContrasena(this.nueva()).valida && this.coinciden() && !this.guardando());

  ngOnInit(): void {
    if (!this.estado.email() || !this.estado.codigo()) {
      this.router.navigate(['/auth/forgot-password']);
    }
  }

  guardar(): void {
    const email = this.estado.email();
    const codigo = this.estado.codigo();
    if (!email || !codigo || !this.puedeGuardar()) return;
    this.guardando.set(true);
    this.error.set(null);
    this.passwordService.restablecer(email, codigo, this.nueva()).subscribe({
      next: () => {
        this.guardando.set(false);
        this.listo.set(true);
        this.estado.limpiar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.error.set(e?.error?.message ?? 'No se pudo guardar la contraseña. Pide un código nuevo.');
      },
    });
  }

  irALogin(): void {
    this.router.navigate(['/auth/login']);
  }
}
