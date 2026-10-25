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
  /** Why the server activated it in a trip ("No confirmó que llegó a…"); null if she activated it. */
  reason: string | null;
  /** true if the server activated it because her phone's signal stopped. */
  signalLost: boolean;
  /** Warning for the contacts while it is active: she did not answer, her signal stopped or she was forced to cancel. */
  warning: AlertWarning | null;
}

export type AlertWarning = 'unanswered' | 'signal_lost' | 'duress';

/** Alert chat message. fromOwner: written by whoever activated the alert. */
export interface AlertMessage {
  id: number;
  fromOwner: boolean;
  name: string;
  text: string;
  time: Date;
}

const toMessage = (m: any): AlertMessage => ({
  id: m.id,
  fromOwner: m.senderType === 'owner',
  name: m.senderName,
  text: m.body,
  time: new Date(m.createdAt),
});

@Injectable({ providedIn: 'root' })
export class TrackingService {
  private http = inject(HttpClient);

  /**
   * delivery: the delivery the contact came from (?c= of the email link), so the user's history shows
   * that this contact already saw the alert.
   */
  query(code: string, delivery?: string | null): Observable<Tracking> {
    // v: anonymous identifier of this browser, so the user knows someone opened her alert
    const params: Record<string, string> = { v: visitor() };
    if (delivery && /^\d+$/.test(delivery)) params['c'] = delivery;
    return this.http.get<any>(`${environment.apiUrl}/api/public/tracking/${encodeURIComponent(code)}`, {
      params,
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
        reason: t.reason || null,
        signalLost: t.activationMethod === 'signal_lost',
        warning: t.warning || null,
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
