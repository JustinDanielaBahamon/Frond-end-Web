import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { environment } from '../../../environments/environment';

const UUID_KEY = 'alerta-mujer-dispositivo-web';

/**
 * Notificaciones del navegador con la pestaña cerrada (Firebase Cloud Messaging). El navegador se
 * registra como un dispositivo "web" de la usuaria con su token push: así el backend le envía la
 * misma alerta que a la app cuando un contacto suyo la activa, y el service worker
 * (public/firebase-messaging-sw.js) la muestra.
 */
@Injectable({ providedIn: 'root' })
export class WebPushService {
  private http = inject(HttpClient);
  private listening = false;

  get configured(): boolean {
    return !!environment.webPushVapidKey && !!environment.firebase?.apiKey;
  }

  /**
   * Registra este navegador (requiere permiso de notificaciones ya concedido). alRecibir se llama
   * cuando llega un aviso con la pestaña abierta.
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

  // Un dispositivo "web" por navegador (se recuerda su identificador)
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
      // modo privado: se creará otro dispositivo la próxima vez
    }
  }
}
