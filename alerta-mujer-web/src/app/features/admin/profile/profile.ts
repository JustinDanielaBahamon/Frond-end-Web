import { AfterViewInit, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { InactivityService } from '../../../core/auth/inactivity.service';
import { ThemeService, Theme } from '../../../core/theme/theme.service';
import { AdminSettingsService } from '../../../core/services/admin-settings.service';
import { AuditService, AuditRecord } from '../../../core/services/audit.service';

const SESSION_ACTIONS: Record<string, string> = {
  LOGIN_SUCCESS: 'Inicio de sesión',
  LOGIN_FAILED: 'Intento fallido',
  LOGOUT: 'Cierre de sesión',
  PASSWORD_CHANGED: 'Cambio de contraseña',
};

/** Mi perfil: lo que cada admin ajusta para sí misma (no afecta al resto del sistema). */
@Component({
  selector: 'app-admin-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class AdminProfileComponent implements AfterViewInit {
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private settingsService = inject(AdminSettingsService);
  private auditService = inject(AuditService);
  readonly inactivity = inject(InactivityService);

  readonly user = toSignal(this.authService.currentUser$, { initialValue: null });
  readonly initials = computed(() =>
    (this.user()?.name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join(''));

  readonly theme = this.themeService.currentTheme;
  readonly isDark = computed(() => this.theme() === 'dark');

  data = { firstName: '', lastName: '', telephone: '' };
  password = { current: '', newOne: '', confirm: '' };
  readonly loadingData = signal(true);
  readonly savingData = signal(false);
  readonly savingPassword = signal(false);

  readonly activity = signal<AuditRecord[]>([]);
  readonly loadingActivity = signal(true);

  readonly message = signal('');
  readonly errorMessage = signal(false);
  private messageTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.settingsService.getMyData().subscribe({
      next: (d) => {
        this.data = d;
        this.loadingData.set(false);
      },
      error: () => {
        this.loadingData.set(false);
        this.notify('No se pudieron cargar tus datos', true);
      },
    });
    this.loadActivity();
  }

  ngAfterViewInit(): void {
    this.route.fragment.subscribe((f) => {
      if (f !== 'contrasena') return;
      setTimeout(() => {
        document.getElementById('contrasena')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        (document.querySelector('input[name=actual]') as HTMLInputElement | null)?.focus();
      });
    });
  }

  // ── Datos ────────────────────────────────────────────────────
  saveData(): void {
    const data = {
      firstName: this.data.firstName.trim(),
      lastName: this.data.lastName.trim(),
      telephone: this.data.telephone.trim(),
    };
    if (!data.firstName) {
      this.notify('El nombre es obligatorio', true);
      return;
    }
    this.savingData.set(true);
    this.settingsService.updateMyData(data).subscribe({
      next: () => {
        this.authService.updateCurrentUser(data);
        this.savingData.set(false);
        this.notify('Datos actualizados');
      },
      error: (err) => {
        this.savingData.set(false);
        this.notify(err?.error?.message || 'No se pudieron guardar tus datos', true);
      },
    });
  }

  // ── Contraseña ───────────────────────────────────────────────
  get fortaleza(): { level: number; text: string } {
    const c = this.password.newOne;
    if (!c) return { level: 0, text: '' };
    let points = 0;
    if (c.length >= 8) points++;
    if (c.length >= 12) points++;
    if (/[A-Z]/.test(c) && /[a-z]/.test(c)) points++;
    if (/\d/.test(c)) points++;
    if (/[^A-Za-z0-9]/.test(c)) points++;
    const level = c.length < 8 ? 1 : Math.min(4, Math.max(1, points - 1));
    return { level, text: ['', 'Débil', 'Aceptable', 'Buena', 'Fuerte'][level] };
  }

  changePassword(): void {
    const { current, newOne, confirm } = this.password;
    if (!current || !newOne) {
      this.notify('Completa la contraseña actual y la nueva', true);
      return;
    }
    if (newOne.length < 8) {
      this.notify('La nueva contraseña debe tener al menos 8 caracteres', true);
      return;
    }
    if (newOne !== confirm) {
      this.notify('Las contraseñas nuevas no coinciden', true);
      return;
    }
    this.savingPassword.set(true);
    this.settingsService.changePassword(current, newOne).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.password = { current: '', newOne: '', confirm: '' };
        this.notify('Contraseña actualizada');
        this.loadActivity();
      },
      error: (err) => {
        this.savingPassword.set(false);
        this.notify(err?.error?.message || 'No se pudo cambiar la contraseña', true);
      },
    });
  }

  // ── Sesión y apariencia ──────────────────────────────────────
  changeInactivity(value: string | number): void {
    this.inactivity.change(Number(value));
    this.notify('Preferencia guardada en este navegador');
  }

  inactivityLabel(min: number): string {
    return min === 0 ? 'Nunca' : `${min} minutos`;
  }

  changeTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }

  signOut(): void {
    this.authService.logout();
  }

  // ── Actividad reciente (mis sesiones) ────────────────────────
  private loadActivity(): void {
    const email = this.user()?.email;
    this.loadingActivity.set(true);
    this.auditService.actors().pipe(
      switchMap((list) => {
        const yo = list.find((r) => r.email === email);
        if (!yo) return of(null);
        return this.auditService.list(
          { actorId: yo.accountId, type: 'SESSION', action: '', from: '', to: '' }, 0, 6);
      })
    ).subscribe({
      next: (p) => {
        this.activity.set(p?.records ?? []);
        this.loadingActivity.set(false);
      },
      error: () => this.loadingActivity.set(false),
    });
  }

  activityText(r: AuditRecord): string {
    return SESSION_ACTIONS[r.action] ?? r.action;
  }

  private notify(text: string, esError = false): void {
    this.message.set(text);
    this.errorMessage.set(esError);
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => this.message.set(''), 3500);
  }
}
