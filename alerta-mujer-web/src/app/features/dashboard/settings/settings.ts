import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PasswordChangeComponent } from '../../../shared/components/password-change/password-change';
import { EliminarCuentaComponent } from '../../../shared/components/eliminar-cuenta/eliminar-cuenta';
import { ThemeService, Theme } from '../../../core/theme/theme.service';
import { AccentColorService } from '../../../core/theme/accent-color.service';
import { AuthService } from '../../../core/auth/auth.service';
import { MovimientoCelularService } from '../../../core/services/movimiento-celular.service';

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
  imports: [CommonModule, RouterLink, PasswordChangeComponent, EliminarCuentaComponent],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class Settings implements OnInit {
  private readonly themeService = inject(ThemeService);
  private readonly accentColorService = inject(AccentColorService);
  private readonly authService = inject(AuthService);
  private readonly movimiento = inject(MovimientoCelularService);

  // --- Cuenta (conectar con el usuario autenticado real) ---
  readonly user = signal({
    name: '',
    email: '',
    phone: '',
    avatarUrl: '',
    verified: false
  });

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(currentUser => {
      if (currentUser) {
        this.user.set({
          name: currentUser.nombre,
          email: currentUser.email,
          phone: currentUser.telephone || '',
          avatarUrl: '',
          verified: true
        });
      }
    });
  }

  // --- Apariencia: tema (global, vía ThemeService) ---
  readonly theme = this.themeService.currentTheme; // 'light' | 'dark'
  readonly isDark = computed(() => this.theme() === 'dark');

  // --- Apariencia: color de acento (global, vía AccentColorService) ---
  readonly accentColors: AccentColor[] = [
    { name: 'Violeta', value: '#7c3aed' },
    { name: 'Índigo profundo', value: '#130253' },
    { name: 'Morado', value: '#710592' },
    { name: 'Orquídea', value: '#d648ec' }
  ];
  readonly selectedColor = this.accentColorService.currentAccent;

  // --- Notificaciones ---
  readonly notifications = signal<ToggleSetting[]>([
    { key: 'emergencyAlerts', label: 'Alertas de emergencia', description: 'Recibe notificaciones de alertas activas.', enabled: true },
    { key: 'appUpdates', label: 'Actualizaciones de la app', description: 'Entérate de nuevas funciones y mejoras.', enabled: true },
    { key: 'securityReminders', label: 'Recordatorios de seguridad', description: 'Consejos y recomendaciones.', enabled: false },
    { key: 'locationNotifications', label: 'Notificaciones de ubicación', description: 'Te avisamos aquí, con un sonido, cuando tu celular cambia de lugar (como mucho cada 30 min). Solo lo ves tú.', enabled: this.movimiento.activo() },
    { key: 'soundVibration', label: 'Sonidos y vibración', description: 'Vibración y sonido en alertas.', enabled: true }
  ]);

  // --- Cambio de contraseña ---
  readonly cambiandoContrasena = signal(false);
  readonly eliminandoCuenta = signal(false);

  toggleTheme(mode: Theme): void {
    this.themeService.setTheme(mode);
  }

  selectColor(color: string): void {
    this.accentColorService.setAccent(color);
  }

  toggleNotification(key: string): void {
    this.notifications.update(list =>
      list.map(item => item.key === key ? { ...item, enabled: !item.enabled } : item)
    );
    if (key === 'locationNotifications') {
      this.movimiento.cambiarActivo(!!this.notifications().find((n) => n.key === key)?.enabled);
    }
  }
}
