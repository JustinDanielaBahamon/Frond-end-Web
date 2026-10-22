import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Alert, AlertStatus, ActivationMethod } from '../models/alert.model';

// Estado del panel → estado del backend
const API_STATUS: Record<AlertStatus, string> = {
  Pendiente: 'active',
  Atendida: 'resolved',
  Cancelada: 'cancelled',
};

@Injectable({ providedIn: 'root' })
export class AlertsService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/alerts`;

  // Usado por ADMIN: todas las alertas
  getAll(): Observable<Alert[]> {
    return this.http.get<any[]>(this.url).pipe(
      map(list => list.map(a => this.normalize(a)))
    );
  }

  // Usado por USUARIA: solo sus propias alertas
  getByUser(userId: number): Observable<Alert[]> {
    return this.http.get<any[]>(`${this.url}/user/${userId}`).pipe(
      map(list => list.map(a => this.normalize(a)))
    );
  }

  // Usado por USUARIA: sus alertas, de la más reciente a la más antigua
  getMine(): Observable<Alert[]> {
    return this.http.get<any[]>(`${this.url}/me`).pipe(
      map(list => list.map(a => this.normalize(a)))
    );
  }

  /** Cuántos contactos recibieron el aviso de una alerta. */
  countNotifiedContacts(id: number): Observable<number> {
    return this.http.get<unknown[]>(`${this.url}/${id}/contacts`).pipe(map(l => l.length));
  }

  getById(id: number): Observable<Alert> {
    return this.http.get<any>(`${this.url}/${id}`).pipe(
      map(a => this.normalize(a))
    );
  }

  // Cambio de estado desde administración (PATCH /api/alerts/{id}/status, solo ADMIN)
  updateStatus(id: number, status: AlertStatus): Observable<Alert> {
    return this.http.patch<any>(`${this.url}/${id}/status`, { status: API_STATUS[status] }).pipe(
      map(a => this.normalize(a))
    );
  }

  /** Detalle del panel: última ubicación y envío a cada contacto (sin nombre ni correo). */
  adminDetail(id: number): Observable<AdminAlertDetail> {
    const date = (iso: string | null) => (iso ? new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`) : null);
    return this.http.get<any>(`${this.url}/${id}/admin-detail`).pipe(
      map((d) => ({
        locationVisible: !!d.ubicacionVisible,
        points: d.puntos ?? 0,
        lastLocation: d.ultimaUbicacion
          ? {
              lat: Number(d.ultimaUbicacion.latitude),
              lng: Number(d.ultimaUbicacion.longitude),
              precision: d.ultimaUbicacion.accuracy != null ? Number(d.ultimaUbicacion.accuracy) : null,
              time: date(d.ultimaUbicacion.recordedAt),
            }
          : null,
        deliveries: (d.envios ?? []).map((e: any) => ({
          contact: e.contacto,
          relationship: e.relationship ?? null,
          channels: (e.channels ?? []).map((c: any) => ({ channel: c.channel, status: c.status, sent: date(c.sentAt) })),
        })),
      })),
    );
  }

  // ── Normalización ──────────────────────────────────────────────
  // Convierte la alerta del backend (campos en inglés) al modelo Alerta del panel.
  // En administración el backend agrega userId, userName y userEmail.
  private normalize(a: any): Alert {
    const lat = a.latitude != null ? Number(a.latitude) : 0;
    const lng = a.longitude != null ? Number(a.longitude) : 0;
    const userId = a.userId ?? a.userProfileId;
    return {
      id: a.id,
      name: a.userName || (userId != null ? `Usuaria #${userId}` : 'Sin nombre'),
      description: a.message ?? '',
      activationMethod: this.normalizeMethod(a.activationMethod),
      time: this.howLongAgo(a.startedAt ?? a.createdAt),
      location: lat || lng ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : '',
      lat,
      lng,
      status: this.normalizeStatus(a.status),
      userId,
      type: a.alertType ?? '',
      created_at: a.createdAt,
      started_at: a.startedAt,
    };
  }

  private normalizeMethod(value: unknown): ActivationMethod {
    const v = String(value ?? '').toLowerCase();
    if (v.includes('widget')) return 'Widget';
    if (v.includes('contact')) return 'Contacto';
    if (v.includes('power')) return 'Botón de encendido';
    if (v.includes('shake') || v.includes('motion') || v.includes('mov')) return 'Movimiento sospechoso';
    if (v.includes('manual') || v.includes('lock')) return 'Manual';
    return 'Botón de pánico';
  }

  private normalizeStatus(value: unknown): AlertStatus {
    const v = String(value ?? '').toLowerCase();
    if (v === 'resolved') return 'Atendida';
    // "expired" (tiempo agotado sin atención) se agrupa con las canceladas
    if (v === 'cancelled' || v === 'expired') return 'Cancelada';
    return 'Pendiente';
  }

  private howLongAgo(date?: string): string {
    if (!date) return '';
    const t = new Date(date).getTime();
    if (isNaN(t)) return '';
    const min = Math.round((Date.now() - t) / 60000);
    if (min < 1) return 'Ahora';
    if (min < 60) return `Hace ${min} min`;
    if (min < 1440) return `Hace ${Math.round(min / 60)} h`;
    return `Hace ${Math.round(min / 1440)} d`;
  }
}

/** Datos extra de una alerta para el panel (GET /api/alerts/{id}/admin-detail). */
export interface AdminAlertDetail {
  /** false: alerta cancelada o vencida, la administración no ve su ubicación (auditoría S2). */
  locationVisible: boolean;
  points: number;
  lastLocation: { lat: number; lng: number; precision: number | null; time: Date | null } | null;
  deliveries: { contact: number; relationship: string | null; channels: { channel: string; status: string; sent: Date | null }[] }[];
}
