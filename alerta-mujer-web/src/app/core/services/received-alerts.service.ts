import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { WebPushService } from './web-push.service';

/** Alert of another person who has the user as an emergency contact. */
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
 * Alerts received as an emergency contact. While the panel is open they are queried every
 * 30 s: if a new active alert arrives the notice appears in the panel and, if the user
 * allowed it, a browser notification.
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

  /** Starts querying (called by the panel when it opens). */
  start(): void {
    if (this.timer) return;
    this.query();
    // With permission already granted, the browser is (re)registered to receive notices with the tab closed
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
      // Offline or expired session: retried on the next query
    } finally {
      this.loading.set(false);
    }
  }

  /** Code to open /seguimiento/{code} of a received alert. */
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

  /** true if the notices arrive even when the tab is closed (the VAPID key is missing if false). */
  get noticesWithTabClosed(): boolean {
    return this.webPush.configured;
  }

  // Browser notification only once per alert (remembered between reloads)
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
      // private mode: nothing happens, the notice could only repeat
    }
  }
}
