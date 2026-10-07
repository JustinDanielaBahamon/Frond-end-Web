import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs/operators';
import { ThemeService, Theme } from '../../../core/theme/theme.service';
import { AccentColorService } from '../../../core/theme/accent-color.service';
import { AuthService } from '../../../core/auth/auth.service';
import { UsersService } from '../../../core/services/users.services';

type FontSize = 'pequeña' | 'normal' | 'grande';

interface AccentColor {
  name: string;
  value: string;
}

interface ToggleSetting {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class Settings {
  private readonly themeService = inject(ThemeService);
  private readonly accentColorService = inject(AccentColorService);
  private readonly authService = inject(AuthService);
  private readonly usersService = inject(UsersService);

  // --- Cuenta: datos reales de la usuaria autenticada ---
  readonly user = signal({
    name: '',
    email: '',
    phone: '',
    avatarUrl: '',
    verified: false
  });

  // --- Edición del perfil (PUT /api/users/me) ---
  readonly editando = signal(false);
  readonly guardando = signal(false);
  readonly errorGuardado = signal('');
  readonly perfil = signal({
    firstName: '',
    lastName: '',
    telephone: '',
    documentNumber: '',
    documentType: 'CC',
    birthdate: '',
  });

  constructor() {
    this.cargarPerfil();
  }

  /** La información de la cuenta se carga al entrar a la pantalla. */
  private cargarPerfil(): void {
    // Nombre, correo y teléfono desde la sesión iniciada.
    this.authService.currentUser$
      .pipe(take(1))
      .subscribe((usuario) => {
        if (!usuario) return;
        this.user.set({
          name:
            [usuario.firstName, usuario.lastName].filter(Boolean).join(' ').trim() ||
            usuario.nombre,
          email: usuario.email,
          phone: usuario.telephone ?? '',
          avatarUrl: '',
          verified: false,
        });
        this.perfil.set({
          firstName: usuario.firstName ?? '',
          lastName: usuario.lastName ?? '',
          telephone: usuario.telephone ?? '',
          documentNumber: '',
          documentType: 'CC',
          birthdate: '',
        });
      });

    // Perfil completo (documento, tipo y fecha de nacimiento) del backend.
    this.usersService.getMe().subscribe({
      next: (perfil: any) => {
        this.perfil.update((p) => ({
          ...p,
          firstName: perfil.firstName ?? p.firstName,
          lastName: perfil.lastName ?? p.lastName,
          telephone: perfil.telephone ?? p.telephone,
          documentNumber: perfil.documentNumber ?? '',
          documentType: perfil.documentType ?? 'CC',
          birthdate: perfil.birthdate ?? '',
        }));
      },
      // Si falla, la sesión ya provee nombre, correo y teléfono.
      error: () => undefined,
    });
  }

  // --- Apariencia: tema (global, vía ThemeService) ---
  readonly theme = this.themeService.currentTheme; // 'light' | 'dark'
  readonly isDark = computed(() => this.theme() === 'dark');

  // --- Apariencia: color de acento (global, vía AccentColorService) ---
  readonly accentColors: AccentColor[] = [
    { name: 'purpura', value: '#7c3aed' }, // color por defecto de la app
    { name: 'rosa', value: '#130253' },
    { name: 'magenta', value: '#710592' },
  ];
  readonly selectedColor = this.accentColorService.currentAccent;

  readonly fontSizes: FontSize[] = ['pequeña', 'normal', 'grande'];
  readonly selectedFontSize = signal<FontSize>('normal');

  // --- Notificaciones ---
  readonly notifications = signal<ToggleSetting[]>([
    { key: 'emergencyAlerts', label: 'Alertas de emergencia', description: 'Recibe notificaciones de alertas activas.', enabled: true },
    { key: 'appUpdates', label: 'Actualizaciones de la app', description: 'Entérate de nuevas funciones y mejoras.', enabled: true },
    { key: 'securityReminders', label: 'Recordatorios de seguridad', description: 'Consejos y recomendaciones.', enabled: false },
    { key: 'locationNotifications', label: 'Notificaciones de ubicación', description: 'Cambios en tu ubicación o zonas cercanas.', enabled: false },
    { key: 'soundVibration', label: 'Sonidos y vibración', description: 'Vibración y sonido en alertas.', enabled: true }
  ]);

  // --- Privacidad ---
  readonly backgroundLocation = signal(true);
  readonly dataUsage = signal<'wifi' | 'wifi-data'>('wifi-data');

  // --- Seguridad ---
  readonly appLockActive = signal(true);
  readonly biometricAuth = signal(true);
  readonly autoLockTime = signal('5 minutos');

  toggleTheme(mode: Theme): void {
    this.themeService.setTheme(mode);
  }

  selectColor(color: string): void {
    this.accentColorService.setAccent(color);
  }

  selectFontSize(size: FontSize): void {
    this.selectedFontSize.set(size);
    document.documentElement.setAttribute('data-font-size', size);
    // TODO: aplicar clase/variable global de tamaño de fuente en styles.scss
  }

  toggleNotification(key: string): void {
    this.notifications.update(list =>
      list.map(item => item.key === key ? { ...item, enabled: !item.enabled } : item)
    );
  }

  toggleBackgroundLocation(): void {
    this.backgroundLocation.update(v => !v);
  }

  toggleBiometricAuth(): void {
    this.biometricAuth.update(v => !v);
  }

  onEditProfile(): void {
    this.errorGuardado.set('');
    this.editando.set(true);
  }

  cancelarEdicion(): void {
    this.editando.set(false);
    this.errorGuardado.set('');
  }

  /** Guarda el perfil en el backend y actualiza la sesión. */
  guardarPerfil(): void {
    const p = this.perfil();
    this.guardando.set(true);
    this.errorGuardado.set('');

    this.usersService
      .updateMe({
        firstName: p.firstName.trim(),
        lastName: p.lastName.trim(),
        telephone: p.telephone.trim(),
        documentNumber: p.documentNumber.trim(),
        documentType: p.documentType,
        birthdate: p.birthdate ? p.birthdate : null,
      })
      .subscribe({
        next: (actualizado: any) => {
          this.guardando.set(false);
          this.editando.set(false);

          const nombre = [actualizado.firstName, actualizado.lastName]
            .filter(Boolean)
            .join(' ')
            .trim();

          this.user.set({
            name: nombre || this.user().name,
            email: actualizado.email ?? this.user().email,
            phone: actualizado.telephone ?? '',
            avatarUrl: '',
            verified: false,
          });

          // La sesión debe reflejar los datos nuevos.
          this.authService.actualizarUsuaria({
            firstName: actualizado.firstName,
            lastName: actualizado.lastName,
            telephone: actualizado.telephone,
            ...(nombre ? { nombre } : {}),
          });
        },
        error: () => {
          this.guardando.set(false);
          this.errorGuardado.set('No se pudo guardar el perfil. Inténtalo de nuevo.');
        },
      });
  }

  onDeleteAccount(): void {
    const confirmed = confirm('¿Estás segura de que deseas eliminar tu cuenta? Esta acción no se puede deshacer.');
    if (confirmed) {
      // TODO: this.usersService.deleteAccount(this.user().email)
    }
  }

  onContactSupport(): void {
    // TODO: this.router.navigate(['/dashboard/asistencia'])
  }
}