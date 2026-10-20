import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Alerta, EstadoAlerta, MedioActivacion } from '../models/alert.model';

// Estado del panel → estado del backend
const ESTADO_API: Record<EstadoAlerta, string> = {
  Pendiente: 'active',
  Atendida: 'resolved',
  Cancelada: 'cancelled',
};

@Injectable({ providedIn: 'root' })
export class AlertsService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/alerts`;

  // Usado por ADMIN: todas las alertas
  getAll(): Observable<Alerta[]> {
    return this.http.get<any[]>(this.url).pipe(
      map(lista => lista.map(a => this.normalizar(a)))
    );
  }

  // Usado por USUARIA: solo sus propias alertas
  getByUsuario(usuarioId: number): Observable<Alerta[]> {
    return this.http.get<any[]>(`${this.url}/user/${usuarioId}`).pipe(
      map(lista => lista.map(a => this.normalizar(a)))
    );
  }

  // Usado por USUARIA: sus alertas, de la más reciente a la más antigua
  getMine(): Observable<Alerta[]> {
    return this.http.get<any[]>(`${this.url}/me`).pipe(
      map(lista => lista.map(a => this.normalizar(a)))
    );
  }

  /** Cuántos contactos recibieron el aviso de una alerta. */
  contarContactosAvisados(id: number): Observable<number> {
    return this.http.get<unknown[]>(`${this.url}/${id}/contacts`).pipe(map(l => l.length));
  }

  getById(id: number): Observable<Alerta> {
    return this.http.get<any>(`${this.url}/${id}`).pipe(
      map(a => this.normalizar(a))
    );
  }

  update(alerta: Alerta): Observable<Alerta> {
    // No enviamos usuarioId/userProfileId, el backend lo establece automáticamente
    const { usuarioId, ...alertaData } = alerta as any;
    return this.http.put<Alerta>(`${this.url}/${alerta.id}`, alertaData);
  }

  // Cambio de estado desde administración (PATCH /api/alerts/{id}/status, solo ADMIN)
  updateEstado(id: number, estado: EstadoAlerta): Observable<Alerta> {
    return this.http.patch<any>(`${this.url}/${id}/status`, { status: ESTADO_API[estado] }).pipe(
      map(a => this.normalizar(a))
    );
  }

  /** Detalle del panel: última ubicación y envío a cada contacto (sin nombre ni correo). */
  detalleAdmin(id: number): Observable<DetalleAdminAlerta> {
    const fecha = (iso: string | null) => (iso ? new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`) : null);
    return this.http.get<any>(`${this.url}/${id}/admin-detail`).pipe(
      map((d) => ({
        ubicacionVisible: !!d.ubicacionVisible,
        puntos: d.puntos ?? 0,
        ultimaUbicacion: d.ultimaUbicacion
          ? {
              lat: Number(d.ultimaUbicacion.latitude),
              lng: Number(d.ultimaUbicacion.longitude),
              precision: d.ultimaUbicacion.accuracy != null ? Number(d.ultimaUbicacion.accuracy) : null,
              hora: fecha(d.ultimaUbicacion.recordedAt),
            }
          : null,
        envios: (d.envios ?? []).map((e: any) => ({
          contacto: e.contacto,
          parentesco: e.relationship ?? null,
          canales: (e.channels ?? []).map((c: any) => ({ canal: c.channel, estado: c.status, enviado: fecha(c.sentAt) })),
        })),
      })),
    );
  }

  // ── Normalización ──────────────────────────────────────────────
  // Convierte la alerta del backend (campos en inglés) al modelo Alerta del panel.
  // En administración el backend agrega userId, userName y userEmail.
  private normalizar(a: any): Alerta {
    const lat = a.latitude != null ? Number(a.latitude) : 0;
    const lng = a.longitude != null ? Number(a.longitude) : 0;
    const usuarioId = a.userId ?? a.userProfileId;
    return {
      id: a.id,
      nombre: a.userName || (usuarioId != null ? `Usuaria #${usuarioId}` : 'Sin nombre'),
      descripcion: a.message ?? '',
      medioActivacion: this.normalizarMedio(a.activationMethod),
      tiempo: this.haceCuanto(a.startedAt ?? a.createdAt),
      ubicacion: lat || lng ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : '',
      lat,
      lng,
      estado: this.normalizarEstado(a.status),
      usuarioId,
      tipo: a.alertType ?? '',
      created_at: a.createdAt,
      started_at: a.startedAt,
    };
  }

  private normalizarMedio(valor: unknown): MedioActivacion {
    const v = String(valor ?? '').toLowerCase();
    if (v.includes('widget')) return 'Widget';
    if (v.includes('contact')) return 'Contacto';
    if (v.includes('shake') || v.includes('motion') || v.includes('mov')) return 'Movimiento sospechoso';
    if (v.includes('manual') || v.includes('lock')) return 'Manual';
    return 'Botón de pánico';
  }

  private normalizarEstado(valor: unknown): EstadoAlerta {
    const v = String(valor ?? '').toLowerCase();
    if (v === 'resolved') return 'Atendida';
    // "expired" (tiempo agotado sin atención) se agrupa con las canceladas
    if (v === 'cancelled' || v === 'expired') return 'Cancelada';
    return 'Pendiente';
  }

  private haceCuanto(fecha?: string): string {
    if (!fecha) return '';
    const t = new Date(fecha).getTime();
    if (isNaN(t)) return '';
    const min = Math.round((Date.now() - t) / 60000);
    if (min < 1) return 'Ahora';
    if (min < 60) return `Hace ${min} min`;
    if (min < 1440) return `Hace ${Math.round(min / 60)} h`;
    return `Hace ${Math.round(min / 1440)} d`;
  }
}

/** Datos extra de una alerta para el panel (GET /api/alerts/{id}/admin-detail). */
export interface DetalleAdminAlerta {
  /** false: alerta cancelada o vencida, la administración no ve su ubicación (auditoría S2). */
  ubicacionVisible: boolean;
  puntos: number;
  ultimaUbicacion: { lat: number; lng: number; precision: number | null; hora: Date | null } | null;
  envios: { contacto: number; parentesco: string | null; canales: { canal: string; estado: string; enviado: Date | null }[] }[];
}
