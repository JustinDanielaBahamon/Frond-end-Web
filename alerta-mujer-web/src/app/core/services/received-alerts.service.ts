import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { WebPushService } from './web-push.service';

/** Alerta de otra persona que tiene a la usuaria como contacto de emergencia. */
export interface ReceivedAlert {
  id: number;
  name: string;
  active: boolean;
  status: string;
  start: Date | null;
  end: Date | null;
  trackingAvailable: boolean;
}

const REFRESH_MS = 30_000;
const NOTIFIED_KEY = 'alerta-mujer-alertas-avisadas';

/**
 * Alertas recibidas como contacto de emergencia. Mientras el panel está abierto se consultan cada
 * 30 s: si llega una alerta activa nueva aparece el aviso en el panel y, si la usuaria lo
 * permitió, una notificación del navegador.
 */
@Injectable({ providedIn: 'root' })
export class ReceivedAlertsService {
  private http = inject(HttpClient);
  private webPush = inject(WebPushService);
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly received = signal<ReceivedAlert[]>([]);
  readonly loading = signal(false);
  readonly active = computed(() => this.received().filter((a) => a.active));
  readonly notificationPermission = signal<NotificationPermission | 'no-soportado'>(
    typeof Notification === 'undefined' ? 'no-soportado' : Notification.permission,
  );

  /** Empieza a consultar (lo llama el panel al abrirse). */
  start(): void {
    if (this.timer) return;
    this.query();
    // Con permiso ya concedido, se (re)registra el navegador para recibir avisos con la pestaña cerrada
    if (this.notificationPermission() === 'granted') this.webPush.activate(() => this.query());
    this.timer = setInterval(() => this.query(), REFRESH_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async query(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/api/received-alerts`));
      const list: ReceivedAlert[] = (data ?? []).map((a) => ({
        id: a.alertId,
        name: a.firstName || 'Un contacto',
        active: !!a.active,
        status: a.status,
        start: a.startedAt ? new Date(a.startedAt) : null,
        end: a.endedAt ? new Date(a.endedAt) : null,
        trackingAvailable: !!a.trackingAvailable,
      }));
      this.received.set(list);
      this.notifyNew(list.filter((a) => a.active));
    } catch {
      // Sin conexión o sesión vencida: se reintenta en la siguiente consulta
    } finally {
      this.loading.set(false);
    }
  }

  /** Código para abrir /seguimiento/{codigo} de una alerta recibida. */
  async trackingCode(id: number): Promise<string> {
    const r = await firstValueFrom(
      this.http.post<{ code: string }>(`${environment.apiUrl}/api/received-alerts/${id}/tracking`, {}),
    );
    return r.code;
  }

  async requestNotificationPermission(): Promise<void> {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    this.notificationPermission.set(permission);
    if (permission === 'granted') await this.webPush.activate(() => this.query());
  }

  /** true si los avisos llegan aunque se cierre la pestaña (falta la clave VAPID si es false). */
  get noticesWithTabClosed(): boolean {
    return this.webPush.configured;
  }

  // Notificación del navegador una sola vez por alerta (se recuerda entre recargas)
  private notifyNew(active: ReceivedAlert[]): void {
    const notified = new Set<number>(this.readNotified());
    const newOnes = active.filter((a) => !notified.has(a.id));
    if (newOnes.length === 0) return;
    newOnes.forEach((a) => notified.add(a.id));
    this.saveNotified([...notified].slice(-50));
    if (this.notificationPermission() !== 'granted') return;
    for (const a of newOnes) {
      const n = new Notification(`🚨 ${a.name} activó una alerta de emergencia`, {
        body: 'Toca para ver dónde está y cómo ayudar.',
        tag: `alerta-${a.id}`,
        requireInteraction: true,
      });
      n.onclick = () => {
        window.focus();
        window.location.assign('/dashboard/alertas-contactos');
      };
    }
  }

  private readNotified(): number[] {
    try {
      return JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  private saveNotified(ids: number[]): void {
    try {
      localStorage.setItem(NOTIFIED_KEY, JSON.stringify(ids));
    } catch {
      // modo privado: no pasa nada, solo podría repetirse el aviso
    }
  }
}
