import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/auth/auth.service';
import { InactivityService } from '../../../core/auth/inactivity.service';
import { ThemeService, Theme } from '../../../core/theme/theme.service';
import { UsersService } from '../../../core/services/users.services';
import { AlertsService } from '../../../core/services/alerts.services';
import { AdminSettingsService, ParametrosApp } from '../../../core/services/admin-settings.service';

type Panel = 'datos' | 'contrasena' | null;

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class AdminSettingsComponent {
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private usersService = inject(UsersService);
  private alertsService = inject(AlertsService);
  private settingsService = inject(AdminSettingsService);
  readonly inactividad = inject(InactivityService);

  // ── Usuario autenticado ──────────────────────────────────────
  readonly user = toSignal(this.authService.currentUser$, { initialValue: null });

  // ── Tema (global, lo maneja ThemeService) ────────────────────
  readonly theme = this.themeService.currentTheme;
  readonly isDark = computed(() => this.theme() === 'dark');

  // ── Mi cuenta ────────────────────────────────────────────────
  readonly panelAbierto = signal<Panel>(null);
  datos = { firstName: '', lastName: '', telephone: '' };
  contrasena = { actual: '', nueva: '', confirmar: '' };
  readonly guardandoCuenta = signal(false);

  // ── Parámetros de la app (servidor) ──────────────────────────
  readonly parametros = signal<ParametrosApp | null>(null);
  form = { duracionMaximaAlertaMin: 30, numeroEmergencia: '', correoSoporte: '' };
  readonly cargandoParametros = signal(true);
  readonly guardandoParametros = signal(false);
  readonly errorParametros = signal('');

  // ── Mensaje flotante ─────────────────────────────────────────
  readonly mensaje = signal('');
  private mensajeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.cargarParametros();
  }

  // ── Tema ─────────────────────────────────────────────────────
  cambiarTema(tema: Theme): void {
    this.themeService.setTheme(tema);
  }

  // ── Mi cuenta ────────────────────────────────────────────────
  abrirPanel(panel: Exclude<Panel, null>): void {
    if (this.panelAbierto() === panel) {
      this.panelAbierto.set(null);
      return;
    }
    if (panel === 'datos') {
      // La sesión guardada puede no traer estos campos: se leen del servidor
      this.settingsService.obtenerMisDatos().subscribe({
        next: (d) => {
          this.datos = d;
          this.panelAbierto.set('datos');
        },
        error: () => this.avisar('No se pudieron cargar tus datos'),
      });
      return;
    } else {
      this.contrasena = { actual: '', nueva: '', confirmar: '' };
    }
    this.panelAbierto.set(panel);
  }

  guardarDatos(): void {
    const datos = {
      firstName: this.datos.firstName.trim(),
      lastName: this.datos.lastName.trim(),
      telephone: this.datos.telephone.trim(),
    };
    if (!datos.firstName) {
      this.avisar('El nombre es obligatorio');
      return;
    }
    this.guardandoCuenta.set(true);
    this.settingsService.actualizarMisDatos(datos).subscribe({
      next: () => {
        this.authService.actualizarUsuarioActual(datos);
        this.guardandoCuenta.set(false);
        this.panelAbierto.set(null);
        this.avisar('Datos actualizados');
      },
      error: (err) => {
        this.guardandoCuenta.set(false);
        this.avisar(err?.error?.message || 'No se pudieron guardar tus datos');
      },
    });
  }

  cambiarContrasena(): void {
    const { actual, nueva, confirmar } = this.contrasena;
    if (!actual || !nueva) {
      this.avisar('Completa la contraseña actual y la nueva');
      return;
    }
    if (nueva.length < 8) {
      this.avisar('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (nueva !== confirmar) {
      this.avisar('Las contraseñas nuevas no coinciden');
      return;
    }
    this.guardandoCuenta.set(true);
    this.settingsService.cambiarContrasena(actual, nueva).subscribe({
      next: () => {
        this.guardandoCuenta.set(false);
        this.panelAbierto.set(null);
        this.contrasena = { actual: '', nueva: '', confirmar: '' };
        this.avisar('Contraseña actualizada');
      },
      error: (err) => {
        this.guardandoCuenta.set(false);
        this.avisar(err?.error?.message || 'No se pudo cambiar la contraseña');
      },
    });
  }

  cerrarSesion(): void {
    this.authService.logout();
  }

  // ── Parámetros de la app ─────────────────────────────────────
  private cargarParametros(): void {
    this.cargandoParametros.set(true);
    this.settingsService.obtenerParametros().subscribe({
      next: (p) => {
        this.aplicarParametros(p);
        this.cargandoParametros.set(false);
      },
      error: () => {
        this.errorParametros.set('No se pudieron cargar los parámetros');
        this.cargandoParametros.set(false);
      },
    });
  }

  guardarParametros(): void {
    this.errorParametros.set('');
    this.guardandoParametros.set(true);
    this.settingsService.guardarParametros({
      duracionMaximaAlertaMin: Number(this.form.duracionMaximaAlertaMin),
      numeroEmergencia: this.form.numeroEmergencia.trim(),
      correoSoporte: this.form.correoSoporte.trim(),
    }).subscribe({
      next: (p) => {
        this.aplicarParametros(p);
        this.guardandoParametros.set(false);
        this.avisar('Parámetros guardados');
      },
      error: (err) => {
        this.guardandoParametros.set(false);
        this.errorParametros.set(err?.error?.message || 'No se pudieron guardar los parámetros');
      },
    });
  }

  private aplicarParametros(p: ParametrosApp): void {
    this.parametros.set(p);
    this.form = {
      duracionMaximaAlertaMin: p.duracionMaximaAlertaMin,
      numeroEmergencia: p.numeroEmergencia,
      correoSoporte: p.correoSoporte,
    };
  }

  // ── Sesión ───────────────────────────────────────────────────
  cambiarInactividad(valor: string): void {
    this.inactividad.cambiar(Number(valor));
    this.avisar('Preferencia de sesión guardada');
  }

  etiquetaInactividad(min: number): string {
    return min === 0 ? 'Nunca' : `${min} minutos`;
  }

  // ── Ayuda ────────────────────────────────────────────────────
  get enlaceSoporte(): string {
    const correo = this.parametros()?.correoSoporte;
    return correo ? `mailto:${correo}?subject=${encodeURIComponent('Ayuda panel Alerta Mujer')}` : '';
  }

  // ── Descargas (CSV con ';', se abre directo en Excel en español) ──
  descargarUsuarios(): void {
    this.usersService.getAll().subscribe({
      next: (usuarios) =>
        this.descargarCsv(
          'lista-usuarios',
          ['ID', 'Nombre', 'Correo', 'Teléfono', 'Estado', 'Rol', 'Alertas', 'Registro'],
          usuarios.map((u) => [u.id, u.nombre, u.email, u.telefono, u.estado, u.rol, u.alertas, u.fechaRegistro])
        ),
      error: () => this.avisar('No se pudo descargar la lista de usuarios'),
    });
  }

  descargarAlertas(): void {
    this.alertsService.getAll().subscribe({
      next: (alertas) => {
        const hace30Dias = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const ultimoMes = alertas.filter((a) => {
          const t = new Date(a.started_at ?? a.created_at ?? '').getTime();
          return isNaN(t) || t >= hace30Dias;
        });
        this.descargarCsv(
          'historial-alertas',
          ['ID', 'Usuaria', 'Activación', 'Estado', 'Inicio', 'Latitud', 'Longitud', 'Mensaje'],
          ultimoMes.map((a) => [a.id, a.nombre, a.medioActivacion, a.estado, a.started_at ?? '', a.lat, a.lng, a.descripcion])
        );
      },
      error: () => this.avisar('No se pudo descargar el historial de alertas'),
    });
  }

  // ── Helpers ──────────────────────────────────────────────────
  private descargarCsv(nombre: string, columnas: string[], filas: unknown[][]): void {
    if (!filas.length) {
      this.avisar('No hay datos para descargar');
      return;
    }

    const escapar = (valor: unknown): string => {
      let texto = valor === null || valor === undefined ? '' : String(valor);
      // Evita que Excel interprete un texto como fórmula
      if (/^[=+\-@]/.test(texto) && !/^-?\d+(\.\d+)?$/.test(texto)) texto = `'${texto}`;
      return `"${texto.replace(/"/g, '""')}"`;
    };

    const csv = [columnas, ...filas].map((fila) => fila.map(escapar).join(';')).join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
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
    this.mensajeTimer = setTimeout(() => this.mensaje.set(''), 3000);
  }
}
