import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Alert, AlertStatus, ActivationMethod } from '../models/alert.model';

// Panel status → backend status
const API_STATUS: Record<AlertStatus, string> = {
  Pendiente: 'active',
  Atendida: 'resolved',
  Cancelada: 'cancelled',
};

@Injectable({ providedIn: 'root' })
export class AlertsService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/alerts`;

  // Used by ADMIN: all alerts
  getAll(): Observable<Alert[]> {
    return this.http.get<any[]>(this.url).pipe(
      map(list => list.map(a => this.normalize(a)))
    );
  }

  // Used by USER: only her own alerts
  getByUser(userId: number): Observable<Alert[]> {
    return this.http.get<any[]>(`${this.url}/user/${userId}`).pipe(
      map(list => list.map(a => this.normalize(a, true)))
    );
  }

  // Used by USER: her alerts, newest to oldest
  getMine(): Observable<Alert[]> {
    return this.http.get<any[]>(`${this.url}/me`).pipe(
      map(list => list.map(a => this.normalize(a, true)))
    );
  }

  /** How many contacts received the notice of an alert. */
  countNotifiedContacts(id: number): Observable<number> {
    return this.http.get<unknown[]>(`${this.url}/${id}/contacts`).pipe(map(l => l.length));
  }

  getById(id: number): Observable<Alert> {
    return this.http.get<any>(`${this.url}/${id}`).pipe(
      map(a => this.normalize(a))
    );
  }

  // Status change from administration (PATCH /api/alerts/{id}/status, ADMIN only)
  updateStatus(id: number, status: AlertStatus): Observable<Alert> {
    return this.http.patch<any>(`${this.url}/${id}/status`, { status: API_STATUS[status] }).pipe(
      map(a => this.normalize(a))
    );
  }

  /** Panel detail: last location and delivery to each contact (without name or email). */
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

  // ── Normalization ──────────────────────────────────────────────
  // Converts the backend alert (English fields) to the panel Alert model.
  // In administration the backend adds userId, userName and userEmail.
  // own: her own views. An alert cancelled with the duress PIN keeps running in silence, but on
  // her screens it shows as cancelled (whoever forced her may be looking), like in the app.
  private normalize(a: any, own = false): Alert {
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
      status: own && a.duressAt ? 'Cancelada' : this.normalizeStatus(a.status),
      userId,
      type: a.alertType ?? '',
      created_at: a.createdAt,
      started_at: a.startedAt,
    };
  }

  private normalizeMethod(value: unknown): ActivationMethod {
    const v = String(value ?? '').toLowerCase();
    // Alerts the server activated in a trip: she did not confirm the arrival or her phone's signal stopped
    if (v === 'signal_lost') return 'Señal perdida';
    if (v === 'timer') return 'Avísame si no llego';
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
    // "expired" (timed out without attention) is grouped with the cancelled ones
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

/** Extra alert data for the panel (GET /api/alerts/{id}/admin-detail). */
export interface AdminAlertDetail {
  /** false: cancelled or expired alert, the administration does not see its location (audit S2). */
  locationVisible: boolean;
  points: number;
  lastLocation: { lat: number; lng: number; precision: number | null; time: Date | null } | null;
  deliveries: { contact: number; relationship: string | null; channels: { channel: string; status: string; sent: Date | null }[] }[];
}
