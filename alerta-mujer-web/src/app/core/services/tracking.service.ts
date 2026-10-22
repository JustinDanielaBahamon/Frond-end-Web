import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { toService } from '../api/service-routes';
import { environment } from '../../../environments/environment';

export interface TrackingPoint {
  lat: number;
  lng: number;
  precision: number | null;
  time: Date;
}

/** Video, audio or photo recorded during the alert (opened with a link that expires in minutes). */
export interface TrackingEvidence {
  id: number;
  type: 'video' | 'audio' | 'photo' | 'document';
  contentType: string;
  created: Date | null;
  url: string;
}

/** What an emergency contact sees from the email link (without signing in). */
export interface Tracking {
  name: string;
  active: boolean;
  status: string;
  start: Date | null;
  end: Date | null;
  route: TrackingPoint[];
  emergencyNumber: string;
  evidences: TrackingEvidence[];
}

/** Alert chat message. fromOwner: written by whoever activated the alert. */
export interface AlertMessage {
  id: number;
  deElla: boolean;
  name: string;
  text: string;
  time: Date;
}

const toMessage = (m: any): AlertMessage => ({
  id: m.id,
  deElla: m.senderType === 'owner',
  name: m.senderName,
  text: m.body,
  time: new Date(m.createdAt),
});

@Injectable({ providedIn: 'root' })
export class TrackingService {
  private http = inject(HttpClient);

  query(code: string): Observable<Tracking> {
    // v: anonymous identifier of this browser, so the user knows someone opened her alert
    return this.http.get<any>(`${environment.apiUrl}/api/public/tracking/${encodeURIComponent(code)}`, {
      params: { v: visitor() },
    }).pipe(
      map(t => ({
        name: t.firstName || 'Una persona',
        active: !!t.active,
        status: t.status,
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
          type: e.mediaType,
          contentType: e.contentType,
          created: e.createdAt ? new Date(e.createdAt) : null,
          url: toService(`${environment.apiUrl}/api/public/tracking/${encodeURIComponent(code)}/evidence/${e.id}`)
        }))
      }))
    );
  }

  /** Mensajes del chat posteriores a despuesDe (0 = todos). */
  messages(code: string, after = 0): Observable<AlertMessage[]> {
    return this.http
      .get<any[]>(`${environment.apiUrl}/api/public/tracking/${encodeURIComponent(code)}/messages`, {
        params: { after },
      })
      .pipe(map((list) => (list ?? []).map(toMessage)));
  }

  sendMessage(code: string, name: string, text: string): Observable<AlertMessage> {
    return this.http
      .post<any>(`${environment.apiUrl}/api/public/tracking/${encodeURIComponent(code)}/messages`, {
        name: name,
        body: text,
      })
      .pipe(map(toMessage));
  }
}

const VISITOR_KEY = 'alerta-mujer-visitante';

/** Anonymous and stable identifier of this browser (contains no personal data). */
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
