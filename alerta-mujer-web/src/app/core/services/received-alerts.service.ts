import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { WebPushService } from './web-push.service';

/** Alerta de otra persona que tiene a la usuaria como contacto de emergencia. */
export interface AlertaRecibida {
  id: number;
  nombre: string;
  activa: boolean;
  estado: string;
  inicio: Date | null;
  fin: Date | null;
  seguimientoDisponible: boolean;
}

const REFRESCO_MS = 30_000;
const CLAVE_AVISADAS = 'alerta-mujer-alertas-avisadas';

/**
 * Alertas recibidas como contacto de emergencia. Mientras el panel está abierto se consultan cada
 * 30 s: si llega una alerta activa nueva aparece el aviso en el panel y, si la usuaria lo
 * permitió, una notificación del navegador.
 */
@Injectable({ providedIn: 'root' })
export class ReceivedAlertsService {
  private http = inject(HttpClient);
  private webPush = inject(WebPushService);
  private temporizador: ReturnType<typeof setInterval> | null = null;

  readonly recibidas = signal<AlertaRecibida[]>([]);
  readonly cargando = signal(false);
  readonly activas = computed(() => this.recibidas().filter((a) => a.activa));
  readonly permisoNotificaciones = signal<NotificationPermission | 'no-soportado'>(
    typeof Notification === 'undefined' ? 'no-soportado' : Notification.permission,
  );

  /** Empieza a consultar (lo llama el panel al abrirse). */
  iniciar(): void {
    if (this.temporizador) return;
    this.consultar();
    // Con permiso ya concedido, se (re)registra el navegador para recibir avisos con la pestaña cerrada
    if (this.permisoNotificaciones() === 'granted') this.webPush.activar(() => this.consultar());
    this.temporizador = setInterval(() => this.consultar(), REFRESCO_MS);
  }

  detener(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
  }

  async consultar(): Promise<void> {
    this.cargando.set(true);
    try {
      const datos = await firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/api/received-alerts`));
      const lista: AlertaRecibida[] = (datos ?? []).map((a) => ({
        id: a.alertId,
        nombre: a.firstName || 'Un contacto',
        activa: !!a.active,
        estado: a.status,
        inicio: a.startedAt ? new Date(a.startedAt) : null,
        fin: a.endedAt ? new Date(a.endedAt) : null,
        seguimientoDisponible: !!a.trackingAvailable,
      }));
      this.recibidas.set(lista);
      this.avisarNuevas(lista.filter((a) => a.activa));
    } catch {
      // Sin conexión o sesión vencida: se reintenta en la siguiente consulta
    } finally {
      this.cargando.set(false);
    }
  }

  /** Código para abrir /seguimiento/{codigo} de una alerta recibida. */
  async codigoSeguimiento(id: number): Promise<string> {
    const r = await firstValueFrom(
      this.http.post<{ code: string }>(`${environment.apiUrl}/api/received-alerts/${id}/tracking`, {}),
    );
    return r.code;
  }

  async pedirPermisoNotificaciones(): Promise<void> {
    if (typeof Notification === 'undefined') return;
    const permiso = await Notification.requestPermission();
    this.permisoNotificaciones.set(permiso);
    if (permiso === 'granted') await this.webPush.activar(() => this.consultar());
  }

  /** true si los avisos llegan aunque se cierre la pestaña (falta la clave VAPID si es false). */
  get avisosConPestanaCerrada(): boolean {
    return this.webPush.configurado;
  }

  // Notificación del navegador una sola vez por alerta (se recuerda entre recargas)
  private avisarNuevas(activas: AlertaRecibida[]): void {
    const avisadas = new Set<number>(this.leerAvisadas());
    const nuevas = activas.filter((a) => !avisadas.has(a.id));
    if (nuevas.length === 0) return;
    nuevas.forEach((a) => avisadas.add(a.id));
    this.guardarAvisadas([...avisadas].slice(-50));
    if (this.permisoNotificaciones() !== 'granted') return;
    for (const a of nuevas) {
      const n = new Notification(`🚨 ${a.nombre} activó una alerta de emergencia`, {
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

  private leerAvisadas(): number[] {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_AVISADAS) ?? '[]');
    } catch {
      return [];
    }
  }

  private guardarAvisadas(ids: number[]): void {
    try {
      localStorage.setItem(CLAVE_AVISADAS, JSON.stringify(ids));
    } catch {
      // modo privado: no pasa nada, solo podría repetirse el aviso
    }
  }
}
