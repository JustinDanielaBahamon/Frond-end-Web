import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService, Theme } from '../../../core/theme/theme.service';
import { UsersService } from '../../../core/services/users.services';
import { AlertsService } from '../../../core/services/alerts.services';

interface AdminConfig {
  dailySummary: boolean;
  twoFactor: boolean;
  inactivityMinutes: number;
  strongPasswords: boolean;
  autoBackup: boolean;
}

type ToggleKey = 'dailySummary' | 'twoFactor' | 'strongPasswords' | 'autoBackup';

const STORAGE_KEY = 'alerta-mujer-admin-config';

const DEFAULT_CONFIG: AdminConfig = {
  dailySummary: true,
  twoFactor: true,
  inactivityMinutes: 15,
  strongPasswords: true,
  autoBackup: true,
};

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class AdminSettingsComponent {
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private usersService = inject(UsersService);
  private alertsService = inject(AlertsService);

  // ── Usuario autenticado ──────────────────────────────────────
  readonly user = toSignal(this.authService.currentUser$, { initialValue: null });

  // ── Tema (global, lo maneja ThemeService) ────────────────────
  readonly theme = this.themeService.currentTheme;
  readonly isDark = computed(() => this.theme() === 'dark');

  // ── Configuración editable ───────────────────────────────────
  readonly config = signal<AdminConfig>(this.cargarConfig());
  readonly opcionesInactividad = [5, 10, 15, 30, 60];

  // ── Textos de estado (fijos por ahora) ───────────────────────
  readonly versionSistema = 'v1.0.0';
  readonly ultimaCopia = 'Hace 10 min';

  // ── Mensaje flotante ─────────────────────────────────────────
  readonly mensaje = signal('');
  private mensajeTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Tema ─────────────────────────────────────────────────────
  cambiarTema(tema: Theme): void {
    this.themeService.setTheme(tema);
  }

  // ── Toggles ──────────────────────────────────────────────────
  toggle(key: ToggleKey): void {
    this.config.update((c) => ({ ...c, [key]: !c[key] }));
  }

  // Cada clic pasa a la siguiente opción: 5 → 10 → 15 → 30 → 60 → 5 ...
  cambiarInactividad(): void {
    const opciones = this.opcionesInactividad;
    const actual = opciones.indexOf(this.config().inactivityMinutes);
    const siguiente = opciones[(actual + 1) % opciones.length];
    this.config.update((c) => ({ ...c, inactivityMinutes: siguiente }));
  }

  // ── Guardar ──────────────────────────────────────────────────
  guardarCambios(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config()));
      this.avisar('Cambios guardados correctamente');
    } catch {
      this.avisar('No se pudieron guardar los cambios');
    }
  }

  // ── Cuenta ───────────────────────────────────────────────────
  cerrarSesion(): void {
    this.authService.logout();
  }

  // ── Opciones sin pantalla aún (conéctalas cuando existan) ────
  abrirOpcion(nombre: string): void {
    this.avisar(`${nombre}: próximamente`);
  }

  // ── Descargas (CSV, se abre directo en Excel) ────────────────
  descargarUsuarios(): void {
    this.usersService.getAll().subscribe({
      next: (usuarios) =>
        this.descargarCsv('lista-usuarios', usuarios as unknown as Record<string, unknown>[]),
      error: () => this.avisar('No se pudo descargar la lista de usuarios'),
    });
  }

  descargarAlertas(): void {
    this.alertsService.getAll().subscribe({
      next: (alertas) => {
        const hace30Dias = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const ultimoMes = alertas.filter((a) => {
          const fecha = a.created_at ?? a.started_at;
          if (!fecha) return true; // si no trae fecha, la incluimos
          const t = new Date(fecha).getTime();
          return isNaN(t) || t >= hace30Dias;
        });
        this.descargarCsv('historial-alertas', ultimoMes as unknown as Record<string, unknown>[]);
      },
      error: () => this.avisar('No se pudo descargar el historial de alertas'),
    });
  }

  // ── Helpers ──────────────────────────────────────────────────
  private descargarCsv(nombre: string, filas: Record<string, unknown>[]): void {
    if (!filas.length) {
      this.avisar('No hay datos para descargar');
      return;
    }

    const columnas = Array.from(new Set(filas.flatMap((f) => Object.keys(f)))).filter(
      (c) => c !== 'password'
    );

    const escapar = (valor: unknown): string => {
      const texto =
        valor === null || valor === undefined
          ? ''
          : typeof valor === 'object'
            ? JSON.stringify(valor)
            : String(valor);
      return `"${texto.replace(/"/g, '""')}"`;
    };

    const csv = [
      columnas.join(','),
      ...filas.map((f) => columnas.map((c) => escapar(f[c])).join(',')),
    ].join('\r\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `${nombre}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);

    this.avisar('Descarga iniciada');
  }

  private avisar(texto: string): void {
    this.mensaje.set(texto);
    if (this.mensajeTimer) clearTimeout(this.mensajeTimer);
    this.mensajeTimer = setTimeout(() => this.mensaje.set(''), 2500);
  }

  private cargarConfig(): AdminConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_CONFIG };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }
}