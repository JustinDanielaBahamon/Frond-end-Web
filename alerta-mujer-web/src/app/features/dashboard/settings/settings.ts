import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, Theme } from '../../../core/theme/theme.service';
import { AccentColorService } from '../../../core/theme/accent-color.service';

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
  imports: [CommonModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class Settings {
  private readonly themeService = inject(ThemeService);
  private readonly accentColorService = inject(AccentColorService);

  // --- Cuenta (mock: reemplazar por el usuario autenticado real) ---
  readonly user = signal({
    name: 'María González',
    email: 'maria.gonzalez@gmail.com',
    phone: '+57 300 123 4567',
    avatarUrl: '',
    verified: true
  });

  // --- Apariencia: tema (global, vía ThemeService) ---
  readonly theme = this.themeService.currentTheme; // 'light' | 'dark'
  readonly isDark = computed(() => this.theme() === 'dark');

  // --- Apariencia: color de acento (global, vía AccentColorService) ---
  readonly accentColors: AccentColor[] = [
    { name: 'purpura', value: '#7c3aed' }, // color por defecto de la app
    { name: 'rosa', value: '#ec4899' },
    { name: 'magenta', value: '#db2777' },
    { name: 'indigo', value: '#6366f1' },
    { name: 'teal', value: '#0d9488' },
    { name: 'azul', value: '#2563eb' }
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
    // TODO: this.router.navigate(['/dashboard/perfil'])
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