import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UsersService } from '../../../core/services/users.services';
import { AlertsService } from '../../../core/services/alerts.services';
import { AdminSettingsService, EstadoSistema, ParametrosApp } from '../../../core/services/admin-settings.service';

type FormParametros = Omit<ParametrosApp, 'actualizado'>;

interface Cambio {
  campo: string;
  antes: string;
  despues: string;
}

const ETIQUETAS: Record<keyof FormParametros, string> = {
  duracionMaximaAlertaMin: 'Duración máxima de una alerta SOS',
  numeroEmergencia: 'Número de emergencia',
  correoSoporte: 'Correo de soporte',
  maxContactos: 'Contactos de emergencia por usuaria',
  versionMinimaApp: 'Versión mínima de la app móvil',
};

/**
 * Configuración del sistema: parámetros globales que afectan a todas las usuarias,
 * estado del servidor y exportación de datos. Lo personal de cada admin está en Mi perfil.
 */
@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class AdminSettingsComponent {
  private usersService = inject(UsersService);
  private alertsService = inject(AlertsService);
  private settingsService = inject(AdminSettingsService);

  // ── Parámetros de la app (servidor) ──────────────────────────
  readonly parametros = signal<ParametrosApp | null>(null);
  form: FormParametros = { duracionMaximaAlertaMin: 30, numeroEmergencia: '', correoSoporte: '', maxContactos: 5, versionMinimaApp: '' };
  readonly cargandoParametros = signal(true);
  readonly guardandoParametros = signal(false);
  readonly errorParametros = signal('');
  readonly cambiosPendientes = signal<Cambio[] | null>(null);

  // ── Estado del sistema ───────────────────────────────────────
  readonly estado = signal<EstadoSistema | null>(null);
  readonly errorEstado = signal(false);

  // ── Mensaje flotante ─────────────────────────────────────────
  readonly mensaje = signal('');
  private mensajeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.cargarParametros();
    this.cargarEstado();
  }

  // ── Parámetros ───────────────────────────────────────────────
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

  private normalizado(): FormParametros {
    return {
      duracionMaximaAlertaMin: Number(this.form.duracionMaximaAlertaMin),
      numeroEmergencia: String(this.form.numeroEmergencia ?? '').trim(),
      correoSoporte: String(this.form.correoSoporte ?? '').trim(),
      maxContactos: Number(this.form.maxContactos),
      versionMinimaApp: String(this.form.versionMinimaApp ?? '').trim(),
    };
  }

  /** Muestra los cambios (antes → después) y pide confirmarlos: afectan a todas las usuarias. */
  revisarCambios(): void {
    this.errorParametros.set('');
    const actual = this.parametros();
    if (!actual) return;
    const nuevo = this.normalizado();
    const valor = (v: string | number) => (v === '' ? '(sin definir)' : String(v));
    const cambios = (Object.keys(ETIQUETAS) as (keyof FormParametros)[])
      .filter((k) => String(actual[k]) !== String(nuevo[k]))
      .map((k) => ({ campo: ETIQUETAS[k], antes: valor(actual[k]), despues: valor(nuevo[k]) }));
    if (cambios.length === 0) {
      this.avisar('No hay cambios para guardar');
      return;
    }
    this.cambiosPendientes.set(cambios);
  }

  cancelarCambios(): void {
    this.cambiosPendientes.set(null);
  }

  descartarCambios(): void {
    const p = this.parametros();
    if (p) this.aplicarParametros(p);
    this.errorParametros.set('');
  }

  confirmarCambios(): void {
    this.guardandoParametros.set(true);
    this.settingsService.guardarParametros(this.normalizado()).subscribe({
      next: (p) => {
        this.aplicarParametros(p);
        this.guardandoParametros.set(false);
        this.cambiosPendientes.set(null);
        this.avisar('Parámetros guardados. El cambio quedó registrado en Auditoría.');
      },
      error: (err) => {
        this.guardandoParametros.set(false);
        this.cambiosPendientes.set(null);
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
      maxContactos: p.maxContactos,
      versionMinimaApp: p.versionMinimaApp,
    };
  }

  // ── Estado del sistema ───────────────────────────────────────
  cargarEstado(): void {
    this.settingsService.obtenerEstado().subscribe({
      next: (e) => {
        this.estado.set(e);
        this.errorEstado.set(false);
      },
      error: () => {
        this.estado.set(null);
        this.errorEstado.set(true);
      },
    });
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
    this.mensajeTimer = setTimeout(() => this.mensaje.set(''), 3500);
  }
}
