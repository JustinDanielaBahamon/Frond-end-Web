import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UsersService } from '../../../core/services/users.services';
import { AlertsService } from '../../../core/services/alerts.services';
import { AdminSettingsService, SystemStatus, AppSettings } from '../../../core/services/admin-settings.service';

type SettingsForm = Omit<AppSettings, 'updated'>;

interface Change {
  field: string;
  before: string;
  after: string;
}

const LABELS: Record<keyof SettingsForm, string> = {
  maxAlertDurationMin: 'Duración máxima de una alerta SOS',
  emergencyNumber: 'Número de emergencia',
  supportEmail: 'Correo de soporte',
  maxContacts: 'Contactos de emergencia por usuaria',
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
  readonly settings = signal<AppSettings | null>(null);
  form: SettingsForm = { maxAlertDurationMin: 30, emergencyNumber: '', supportEmail: '', maxContacts: 5, versionMinimaApp: '' };
  readonly loadingSettings = signal(true);
  readonly savingSettings = signal(false);
  readonly settingsError = signal('');
  readonly pendingChanges = signal<Change[] | null>(null);

  // ── Estado del sistema ───────────────────────────────────────
  readonly status = signal<SystemStatus | null>(null);
  readonly statusError = signal(false);

  // ── Mensaje flotante ─────────────────────────────────────────
  readonly message = signal('');
  private messageTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.loadSettings();
    this.loadStatus();
  }

  // ── Parámetros ───────────────────────────────────────────────
  private loadSettings(): void {
    this.loadingSettings.set(true);
    this.settingsService.getSettings().subscribe({
      next: (p) => {
        this.applySettings(p);
        this.loadingSettings.set(false);
      },
      error: () => {
        this.settingsError.set('No se pudieron cargar los parámetros');
        this.loadingSettings.set(false);
      },
    });
  }

  private normalized(): SettingsForm {
    return {
      maxAlertDurationMin: Number(this.form.maxAlertDurationMin),
      emergencyNumber: String(this.form.emergencyNumber ?? '').trim(),
      supportEmail: String(this.form.supportEmail ?? '').trim(),
      maxContacts: Number(this.form.maxContacts),
      versionMinimaApp: String(this.form.versionMinimaApp ?? '').trim(),
    };
  }

  /** Muestra los cambios (antes → después) y pide confirmarlos: afectan a todas las usuarias. */
  checkChanges(): void {
    this.settingsError.set('');
    const current = this.settings();
    if (!current) return;
    const newOne = this.normalized();
    const value = (v: string | number) => (v === '' ? '(sin definir)' : String(v));
    const changes = (Object.keys(LABELS) as (keyof SettingsForm)[])
      .filter((k) => String(current[k]) !== String(newOne[k]))
      .map((k) => ({ field: LABELS[k], before: value(current[k]), after: value(newOne[k]) }));
    if (changes.length === 0) {
      this.notify('No hay cambios para guardar');
      return;
    }
    this.pendingChanges.set(changes);
  }

  cancelChanges(): void {
    this.pendingChanges.set(null);
  }

  discardChanges(): void {
    const p = this.settings();
    if (p) this.applySettings(p);
    this.settingsError.set('');
  }

  confirmChanges(): void {
    this.savingSettings.set(true);
    this.settingsService.saveSettings(this.normalized()).subscribe({
      next: (p) => {
        this.applySettings(p);
        this.savingSettings.set(false);
        this.pendingChanges.set(null);
        this.notify('Parámetros guardados. El cambio quedó registrado en Auditoría.');
      },
      error: (err) => {
        this.savingSettings.set(false);
        this.pendingChanges.set(null);
        this.settingsError.set(err?.error?.message || 'No se pudieron guardar los parámetros');
      },
    });
  }

  private applySettings(p: AppSettings): void {
    this.settings.set(p);
    this.form = {
      maxAlertDurationMin: p.maxAlertDurationMin,
      emergencyNumber: p.emergencyNumber,
      supportEmail: p.supportEmail,
      maxContacts: p.maxContacts,
      versionMinimaApp: p.versionMinimaApp,
    };
  }

  // ── Estado del sistema ───────────────────────────────────────
  loadStatus(): void {
    this.settingsService.getStatus().subscribe({
      next: (e) => {
        this.status.set(e);
        this.statusError.set(false);
      },
      error: () => {
        this.status.set(null);
        this.statusError.set(true);
      },
    });
  }

  // ── Ayuda ────────────────────────────────────────────────────
  get supportLink(): string {
    const email = this.settings()?.supportEmail;
    return email ? `mailto:${email}?subject=${encodeURIComponent('Ayuda panel Alerta Mujer')}` : '';
  }

  // ── Descargas (CSV con ';', se abre directo en Excel en español) ──
  downloadUsers(): void {
    this.usersService.getAll().subscribe({
      next: (users) =>
        this.downloadCsv(
          'lista-usuarios',
          ['ID', 'Nombre', 'Correo', 'Teléfono', 'Estado', 'Rol', 'Alertas', 'Registro'],
          users.map((u) => [u.id, u.name, u.email, u.telephone, u.status, u.role, u.alerts, u.registeredAt])
        ),
      error: () => this.notify('No se pudo descargar la lista de usuarios'),
    });
  }

  downloadAlerts(): void {
    this.alertsService.getAll().subscribe({
      next: (alerts) => {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const lastMonth = alerts.filter((a) => {
          const t = new Date(a.started_at ?? a.created_at ?? '').getTime();
          return isNaN(t) || t >= thirtyDaysAgo;
        });
        this.downloadCsv(
          'historial-alertas',
          ['ID', 'Usuaria', 'Activación', 'Estado', 'Inicio', 'Latitud', 'Longitud', 'Mensaje'],
          lastMonth.map((a) => [a.id, a.name, a.activationMethod, a.status, a.started_at ?? '', a.lat, a.lng, a.description])
        );
      },
      error: () => this.notify('No se pudo descargar el historial de alertas'),
    });
  }

  private downloadCsv(name: string, columns: string[], rows: unknown[][]): void {
    if (!rows.length) {
      this.notify('No hay datos para descargar');
      return;
    }

    const escape = (value: unknown): string => {
      let text = value === null || value === undefined ? '' : String(value);
      // Evita que Excel interprete un texto como fórmula
      if (/^[=+\-@]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };

    const csv = [columns, ...rows].map((row) => row.map(escape).join(';')).join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    this.notify('Descarga iniciada');
  }

  private notify(text: string): void {
    this.message.set(text);
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => this.message.set(''), 3500);
  }
}
