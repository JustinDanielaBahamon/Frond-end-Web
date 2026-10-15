import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { InactivityService } from '../../../core/auth/inactivity.service';
import { ThemeService, Theme } from '../../../core/theme/theme.service';
import { AdminSettingsService } from '../../../core/services/admin-settings.service';
import { AuditService, RegistroAuditoria } from '../../../core/services/audit.service';

const ACCIONES_SESION: Record<string, string> = {
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
export class AdminProfileComponent {
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private settingsService = inject(AdminSettingsService);
  private auditService = inject(AuditService);
  readonly inactividad = inject(InactivityService);

  readonly user = toSignal(this.authService.currentUser$, { initialValue: null });
  readonly iniciales = computed(() =>
    (this.user()?.nombre ?? '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join(''));

  readonly theme = this.themeService.currentTheme;
  readonly isDark = computed(() => this.theme() === 'dark');

  datos = { firstName: '', lastName: '', telephone: '' };
  contrasena = { actual: '', nueva: '', confirmar: '' };
  readonly cargandoDatos = signal(true);
  readonly guardandoDatos = signal(false);
  readonly guardandoContrasena = signal(false);

  readonly actividad = signal<RegistroAuditoria[]>([]);
  readonly cargandoActividad = signal(true);

  readonly mensaje = signal('');
  readonly mensajeError = signal(false);
  private mensajeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.settingsService.obtenerMisDatos().subscribe({
      next: (d) => {
        this.datos = d;
        this.cargandoDatos.set(false);
      },
      error: () => {
        this.cargandoDatos.set(false);
        this.avisar('No se pudieron cargar tus datos', true);
      },
    });
    this.cargarActividad();
  }

  // ── Datos ────────────────────────────────────────────────────
  guardarDatos(): void {
    const datos = {
      firstName: this.datos.firstName.trim(),
      lastName: this.datos.lastName.trim(),
      telephone: this.datos.telephone.trim(),
    };
    if (!datos.firstName) {
      this.avisar('El nombre es obligatorio', true);
      return;
    }
    this.guardandoDatos.set(true);
    this.settingsService.actualizarMisDatos(datos).subscribe({
      next: () => {
        this.authService.actualizarUsuarioActual(datos);
        this.guardandoDatos.set(false);
        this.avisar('Datos actualizados');
      },
      error: (err) => {
        this.guardandoDatos.set(false);
        this.avisar(err?.error?.message || 'No se pudieron guardar tus datos', true);
      },
    });
  }

  // ── Contraseña ───────────────────────────────────────────────
  get fortaleza(): { nivel: number; texto: string } {
    const c = this.contrasena.nueva;
    if (!c) return { nivel: 0, texto: '' };
    let puntos = 0;
    if (c.length >= 8) puntos++;
    if (c.length >= 12) puntos++;
    if (/[A-Z]/.test(c) && /[a-z]/.test(c)) puntos++;
    if (/\d/.test(c)) puntos++;
    if (/[^A-Za-z0-9]/.test(c)) puntos++;
    const nivel = c.length < 8 ? 1 : Math.min(4, Math.max(1, puntos - 1));
    return { nivel, texto: ['', 'Débil', 'Aceptable', 'Buena', 'Fuerte'][nivel] };
  }

  cambiarContrasena(): void {
    const { actual, nueva, confirmar } = this.contrasena;
    if (!actual || !nueva) {
      this.avisar('Completa la contraseña actual y la nueva', true);
      return;
    }
    if (nueva.length < 8) {
      this.avisar('La nueva contraseña debe tener al menos 8 caracteres', true);
      return;
    }
    if (nueva !== confirmar) {
      this.avisar('Las contraseñas nuevas no coinciden', true);
      return;
    }
    this.guardandoContrasena.set(true);
    this.settingsService.cambiarContrasena(actual, nueva).subscribe({
      next: () => {
        this.guardandoContrasena.set(false);
        this.contrasena = { actual: '', nueva: '', confirmar: '' };
        this.avisar('Contraseña actualizada');
        this.cargarActividad();
      },
      error: (err) => {
        this.guardandoContrasena.set(false);
        this.avisar(err?.error?.message || 'No se pudo cambiar la contraseña', true);
      },
    });
  }

  // ── Sesión y apariencia ──────────────────────────────────────
  cambiarInactividad(valor: string | number): void {
    this.inactividad.cambiar(Number(valor));
    this.avisar('Preferencia guardada en este navegador');
  }

  etiquetaInactividad(min: number): string {
    return min === 0 ? 'Nunca' : `${min} minutos`;
  }

  cambiarTema(tema: Theme): void {
    this.themeService.setTheme(tema);
  }

  cerrarSesion(): void {
    this.authService.logout();
  }

  // ── Actividad reciente (mis sesiones) ────────────────────────
  private cargarActividad(): void {
    const correo = this.user()?.email;
    this.cargandoActividad.set(true);
    this.auditService.responsables().pipe(
      switchMap((lista) => {
        const yo = lista.find((r) => r.correo === correo);
        if (!yo) return of(null);
        return this.auditService.listar(
          { responsableId: yo.cuentaId, tipo: 'SESSION', accion: '', desde: '', hasta: '' }, 0, 6);
      })
    ).subscribe({
      next: (p) => {
        this.actividad.set(p?.registros ?? []);
        this.cargandoActividad.set(false);
      },
      error: () => this.cargandoActividad.set(false),
    });
  }

  textoActividad(r: RegistroAuditoria): string {
    return ACCIONES_SESION[r.accion] ?? r.accion;
  }

  private avisar(texto: string, esError = false): void {
    this.mensaje.set(texto);
    this.mensajeError.set(esError);
    if (this.mensajeTimer) clearTimeout(this.mensajeTimer);
    this.mensajeTimer = setTimeout(() => this.mensaje.set(''), 3500);
  }
}
