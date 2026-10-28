import { TPipe } from '../../../core/i18n/i18n';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CardComponent } from '../../../shared/components/card/card';
import { PasswordService } from '../../../core/services/password.service';
import { RecoveryStateService } from '../../../core/services/recovery-state.service';

const DIGITS = 6;
const RESEND_WAIT = 60; // the backend accepts one code per minute

@Component({
  selector: 'app-verify-code',
  standalone: true,
  imports: [TPipe, FormsModule, RouterModule, CardComponent],
  templateUrl: './verify-code.html',
  styleUrl: './verify-code.scss'
})
export class VerifyCodeComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private passwordService = inject(PasswordService);
  private status = inject(RecoveryStateService);

  readonly email = this.status.email;
  code = signal<string[]>(Array(DIGITS).fill(''));
  remainingTime = signal(RESEND_WAIT);
  verifying = signal(false);
  error = signal<string | null>(null);
  notice = signal<string | null>(null);

  readonly fullCode = computed(() => this.code().every((x) => x !== ''));
  readonly canResend = computed(() => this.remainingTime() === 0);
  readonly formattedTime = computed(() => {
    const t = this.remainingTime();
    return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`;
  });
  /** a***@correo.com: shows where it was sent without exposing the whole email. */
  readonly maskedEmail = computed(() => {
    const e = this.email() ?? '';
    const [u, d] = e.split('@');
    return d ? `${u.slice(0, 2)}${'•'.repeat(Math.max(1, u.length - 2))}@${d}` : e;
  });

  private interval?: ReturnType<typeof setInterval>;

  ngOnInit() {
    if (!this.email()) {
      this.router.navigate(['/auth/forgot-password']);
      return;
    }
    this.startTimer();
  }

  ngOnDestroy() {
    clearInterval(this.interval);
  }

  onInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '');
    this.error.set(null);
    // Several digits at once (browser autofill or pasting into a box): they are spread
    if (digits.length > 1) {
      this.distribute(digits, index);
      return;
    }
    input.value = digits;
    this.code.update((c) => c.map((x, i) => (i === index ? digits : x)));
    if (digits && input.nextElementSibling instanceof HTMLInputElement) {
      input.nextElementSibling.focus();
    }
  }

  private distribute(digits: string, from: number) {
    this.code.update((c) => c.map((x, i) => (i >= from && i - from < digits.length ? digits[i - from] : x)));
    const checkboxes = document.querySelectorAll<HTMLInputElement>('.code-input');
    checkboxes.forEach((el, i) => (el.value = this.code()[i]));
    checkboxes[Math.min(from + digits.length, DIGITS) - 1]?.focus();
  }

  onKeyDown(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Backspace' && !input.value && input.previousElementSibling instanceof HTMLInputElement) {
      input.previousElementSibling.focus();
    }
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, DIGITS) ?? '';
    if (text) this.distribute(text, 0);
  }

  private startTimer() {
    clearInterval(this.interval);
    this.remainingTime.set(RESEND_WAIT);
    this.interval = setInterval(() => {
      this.remainingTime.update((t) => Math.max(0, t - 1));
      if (this.remainingTime() === 0) clearInterval(this.interval);
    }, 1000);
  }

  resendCode() {
    const email = this.email();
    if (!email || !this.canResend()) return;
    this.error.set(null);
    this.passwordService.requestCode(email).subscribe({
      next: () => {
        this.code.set(Array(DIGITS).fill(''));
        this.notice.set('Te enviamos un código nuevo. El anterior ya no sirve.');
        this.startTimer();
      },
      error: () => this.error.set('No pudimos reenviar el código. Inténtalo de nuevo en un momento.'),
    });
  }

  verifyCode() {
    const email = this.email();
    const code = this.code().join('');
    if (!email || !this.fullCode() || this.verifying()) return;
    this.verifying.set(true);
    this.error.set(null);
    this.passwordService.verifyCode(email, code).subscribe({
      next: () => {
        this.verifying.set(false);
        this.status.code.set(code);
        this.router.navigate(['/auth/reset-password']);
      },
      error: (e) => {
        this.verifying.set(false);
        this.error.set(e?.status === 429
          ? 'Hiciste muchos intentos. Espera un minuto.'
          : e?.error?.message ?? 'El código no es válido o ya venció.');
      },
    });
  }

  changeEmail() {
    this.router.navigate(['/auth/forgot-password']);
  }
}
