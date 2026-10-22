import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { toService } from '../api/servicios';
import { environment } from '../../../environments/environment';

export interface TrackingPoint {
  lat: number;
  lng: number;
  precision: number | null;
  time: Date;
}

/** Video, audio o foto grabado durante la alerta (se abre con un enlace que vence en minutos). */
export interface TrackingEvidence {
  id: number;
  tipo: 'video' | 'audio' | 'photo' | 'document';
  contentType: string;
  created: Date | null;
  url: string;
}

/** Lo que ve un contacto de emergencia desde el enlace del correo (sin iniciar sesión). */
export interface Tracking {
  nombre: string;
  active: boolean;
  estado: string;
  start: Date | null;
  end: Date | null;
  route: TrackingPoint[];
  emergencyNumber: string;
  evidences: TrackingEvidence[];
}

/** Mensaje del chat de la alerta. deElla: lo escribió quien activó la alerta. */
export interface AlertMessage {
  id: number;
  deElla: boolean;
  nombre: string;
  text: string;
  time: Date;
}

const toMessage = (m: any): AlertMessage => ({
  id: m.id,
  deElla: m.senderType === 'owner',
  nombre: m.senderName,
  text: m.body,
  time: new Date(m.createdAt),
});

@Injectable({ providedIn: 'root' })
export class TrackingService {
  private http = inject(HttpClient);

  query(codigo: string): Observable<Tracking> {
    // v: identificador anónimo de este navegador, para que la usuaria sepa que alguien abrió su alerta
    return this.http.get<any>(`${environment.apiUrl}/api/public/tracking/${encodeURIComponent(codigo)}`, {
      params: { v: visitor() },
    }).pipe(
      map(t => ({
        nombre: t.firstName || 'Una persona',
        active: !!t.active,
        estado: t.status,
        start: t.startedAt ? new Date(t.startedAt) : null,
        end: t.endedAt ? new Date(t.endedAt) : null,
        route: (t.route ?? []).map((p: any) => ({
          lat: Number(p.latitude),
          lng: Number(p.longitude),
          precision: p.accuracy != null ? Number(p.accuracy) : null,
          time: new Date(p.recordedAt)
        })),
        emergencyNumber: t.emergencyNumber || '123',
        evidences: (t.evidence ?? []).map((e: any) => ({
          id: e.id,
          tipo: e.mediaType,
          contentType: e.contentType,
          created: e.createdAt ? new Date(e.createdAt) : null,
          url: toService(`${environment.apiUrl}/api/public/tracking/${encodeURIComponent(codigo)}/evidence/${e.id}`)
        }))
      }))
    );
  }

  /** Mensajes del chat posteriores a despuesDe (0 = todos). */
  messages(codigo: string, after = 0): Observable<AlertMessage[]> {
    return this.http
      .get<any[]>(`${environment.apiUrl}/api/public/tracking/${encodeURIComponent(codigo)}/messages`, {
        params: { after },
      })
      .pipe(map((list) => (list ?? []).map(toMessage)));
  }

  sendMessage(codigo: string, nombre: string, text: string): Observable<AlertMessage> {
    return this.http
      .post<any>(`${environment.apiUrl}/api/public/tracking/${encodeURIComponent(codigo)}/messages`, {
        name: nombre,
        body: text,
      })
      .pipe(map(toMessage));
  }
}

const VISITOR_KEY = 'alerta-mujer-visitante';

/** Identificador anónimo y estable de este navegador (no contiene datos personales). */
function visitor(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = 'web-' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return 'web-sin-almacenamiento';
  }
}
