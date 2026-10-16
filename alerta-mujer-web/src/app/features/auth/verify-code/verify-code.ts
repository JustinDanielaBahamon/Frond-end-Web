import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CardComponent } from '../../../shared/components/card/card';
import { PasswordService } from '../../../core/services/password.service';
import { RecoveryStateService } from '../../../core/services/recovery-state.service';

const DIGITOS = 6;
const ESPERA_REENVIO = 60; // el backend acepta un código por minuto

@Component({
  selector: 'app-verify-code',
  standalone: true,
  imports: [FormsModule, RouterModule, CardComponent],
  templateUrl: './verify-code.html',
  styleUrl: './verify-code.scss'
})
export class VerifyCodeComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private passwordService = inject(PasswordService);
  private estado = inject(RecoveryStateService);

  readonly email = this.estado.email;
  codigo = signal<string[]>(Array(DIGITOS).fill(''));
  tiempoRestante = signal(ESPERA_REENVIO);
  verificando = signal(false);
  error = signal<string | null>(null);
  aviso = signal<string | null>(null);

  readonly codigoCompleto = computed(() => this.codigo().every((x) => x !== ''));
  readonly puedeReenviar = computed(() => this.tiempoRestante() === 0);
  readonly tiempoFormateado = computed(() => {
    const t = this.tiempoRestante();
    return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`;
  });
  /** a***@correo.com: se muestra a dónde se envió sin exponer todo el correo. */
  readonly correoOculto = computed(() => {
    const e = this.email() ?? '';
    const [u, d] = e.split('@');
    return d ? `${u.slice(0, 2)}${'•'.repeat(Math.max(1, u.length - 2))}@${d}` : e;
  });

  private intervalo?: ReturnType<typeof setInterval>;

  ngOnInit() {
    if (!this.email()) {
      this.router.navigate(['/auth/forgot-password']);
      return;
    }
    this.iniciarTemporizador();
  }

  ngOnDestroy() {
    clearInterval(this.intervalo);
  }

  onInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const digitos = input.value.replace(/\D/g, '');
    this.error.set(null);
    // Varios dígitos a la vez (autocompletado del navegador o pegar en una casilla): se reparten
    if (digitos.length > 1) {
      this.repartir(digitos, index);
      return;
    }
    input.value = digitos;
    this.codigo.update((c) => c.map((x, i) => (i === index ? digitos : x)));
    if (digitos && input.nextElementSibling instanceof HTMLInputElement) {
      input.nextElementSibling.focus();
    }
  }

  private repartir(digitos: string, desde: number) {
    this.codigo.update((c) => c.map((x, i) => (i >= desde && i - desde < digitos.length ? digitos[i - desde] : x)));
    const casillas = document.querySelectorAll<HTMLInputElement>('.code-input');
    casillas.forEach((el, i) => (el.value = this.codigo()[i]));
    casillas[Math.min(desde + digitos.length, DIGITOS) - 1]?.focus();
  }

  onKeyDown(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Backspace' && !input.value && input.previousElementSibling instanceof HTMLInputElement) {
      input.previousElementSibling.focus();
    }
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const texto = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, DIGITOS) ?? '';
    if (texto) this.repartir(texto, 0);
  }

  private iniciarTemporizador() {
    clearInterval(this.intervalo);
    this.tiempoRestante.set(ESPERA_REENVIO);
    this.intervalo = setInterval(() => {
      this.tiempoRestante.update((t) => Math.max(0, t - 1));
      if (this.tiempoRestante() === 0) clearInterval(this.intervalo);
    }, 1000);
  }

  reenviarCodigo() {
    const email = this.email();
    if (!email || !this.puedeReenviar()) return;
    this.error.set(null);
    this.passwordService.pedirCodigo(email).subscribe({
      next: () => {
        this.codigo.set(Array(DIGITOS).fill(''));
        this.aviso.set('Te enviamos un código nuevo. El anterior ya no sirve.');
        this.iniciarTemporizador();
      },
      error: () => this.error.set('No pudimos reenviar el código. Inténtalo de nuevo en un momento.'),
    });
  }

  verificarCodigo() {
    const email = this.email();
    const codigo = this.codigo().join('');
    if (!email || !this.codigoCompleto() || this.verificando()) return;
    this.verificando.set(true);
    this.error.set(null);
    this.passwordService.verificarCodigo(email, codigo).subscribe({
      next: () => {
        this.verificando.set(false);
        this.estado.codigo.set(codigo);
        this.router.navigate(['/auth/reset-password']);
      },
      error: (e) => {
        this.verificando.set(false);
        this.error.set(e?.status === 429
          ? 'Hiciste muchos intentos. Espera un minuto.'
          : e?.error?.message ?? 'El código no es válido o ya venció.');
      },
    });
  }

  cambiarCorreo() {
    this.router.navigate(['/auth/forgot-password']);
  }
}
