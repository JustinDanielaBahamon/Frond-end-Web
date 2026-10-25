import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { environment } from '../../../environments/environment';

const UUID_KEY = 'alerta-mujer-dispositivo-web';

/**
 * Browser notifications with the tab closed (Firebase Cloud Messaging). The browser
 * registers as a "web" device of the user with its push token: that way the backend sends it the
 * same alert as the app when one of her contacts activates it, and the service worker
 * (public/firebase-messaging-sw.js) shows it.
 */
@Injectable({ providedIn: 'root' })
export class WebPushService {
  private http = inject(HttpClient);
  private listening = false;

  get configured(): boolean {
    return !!environment.webPushVapidKey && !!environment.firebase?.apiKey;
  }

  /**
   * Registers this browser (requires notification permission already granted). onReceive is called
   * when a notice arrives with the tab open.
   */
  async activate(onReceive?: () => void): Promise<boolean> {
    if (!this.configured || typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
    if (!('serviceWorker' in navigator) || !(await isSupported())) return false;
    try {
      const app = getApps().length ? getApp() : initializeApp(environment.firebase);
      const record = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const messaging = getMessaging(app);
      const token = await getToken(messaging, {
        vapidKey: environment.webPushVapidKey,
        serviceWorkerRegistration: record,
      });
      if (!token) return false;
      const id = await this.webDevice();
      await firstValueFrom(this.http.put(`${environment.apiUrl}/api/devices/${id}/push-token`, { token }));
      if (!this.listening) {
        this.listening = true;
        onMessage(messaging, () => onReceive?.());
      }
      return true;
    } catch (e) {
      console.warn('No se pudieron activar las notificaciones del navegador:', e);
      return false;
    }
  }

  // One "web" device per browser (its identifier is remembered)
  private async webDevice(): Promise<number> {
    let uuid = this.leerUuid();
    if (uuid) {
      const mine = await firstValueFrom(this.http.get<{ id: number; deviceUuid?: string }[]>(`${environment.apiUrl}/api/devices/user`));
      const existing = mine.find((d) => d.deviceUuid === uuid);
      if (existing) return existing.id;
    } else {
      uuid = crypto.randomUUID();
      this.saveUuid(uuid);
    }
    const created = await firstValueFrom(
      this.http.post<{ id: number }>(`${environment.apiUrl}/api/devices`, {
        deviceUuid: uuid,
        osName: 'web',
        deviceName: this.browserName(),
        osVersion: navigator.platform || null,
        gpsStatus: 'unknown',
        status: 'active',
      }),
    );
    return created.id;
  }

  private browserName(): string {
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
    return `Panel web (${browser})`;
  }

  private leerUuid(): string | null {
    try {
      return localStorage.getItem(UUID_KEY);
    } catch {
      return null;
    }
  }

  private saveUuid(uuid: string): void {
    try {
      localStorage.setItem(UUID_KEY, uuid);
    } catch {
      // private mode: another device will be created next time
    }
  }
}
