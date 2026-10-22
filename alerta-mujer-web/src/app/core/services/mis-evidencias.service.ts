import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export type EvidenceType = 'photo' | 'video' | 'audio' | 'document';

/** Evidencia de la usuaria autenticada (GET /api/evidences/me). */
export interface MyEvidence {
  id: number;
  alertId: number;
  type: EvidenceType;
  fileName: string;
  contentType: string;
  sizeBytes: number | null;
  sha256: string | null;
  hasFile: boolean;
  date: Date;
  alert: {
    id: number;
    type: string;
    method: string;
    status: string;
    start: Date | null;
    lat: number | null;
    lng: number | null;
  } | null;
}

export interface MyAlert {
  id: number;
  status: string;
  method: string;
  start: Date;
  lat: number | null;
  lng: number | null;
  /** La usuaria la marcó para que sus evidencias no se borren a los 60 días. */
  keep: boolean;
}

interface EvidenceViewApi {
  id: number;
  alertId: number;
  mediaType: EvidenceType;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  hasFile: boolean;
  createdAt: string;
  alert: {
    id: number; alertType: string; activationMethod: string; status: string;
    startedAt: string | null; latitude: number | null; longitude: number | null;
  } | null;
}

// El backend envía LocalDateTime en UTC sin zona
const utcDate = (iso: string | null | undefined): Date | null =>
  iso ? new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`) : null;

@Injectable({ providedIn: 'root' })
export class MyEvidenceService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/evidences`;

  list(): Observable<MyEvidence[]> {
    return this.http.get<EvidenceViewApi[]>(`${this.url}/me`).pipe(map((l) => l.map(fromApi)));
  }

  /** El archivo se pide con el token y se muestra como blob: nunca hay una URL pública. */
  file(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/file`, { responseType: 'blob' });
  }

  upload(file: File, alertId: number): Observable<HttpEvent<EvidenceViewApi>> {
    const form = new FormData();
    form.append('file', file);
    form.append('alertId', String(alertId));
    return this.http.post<EvidenceViewApi>(`${this.url}/upload`, form, { reportProgress: true, observe: 'events' });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  myAlerts(): Observable<MyAlert[]> {
    return this.http
      .get<Array<{
        id: number; status: string; activationMethod: string; startedAt: string;
        latitude: number | null; longitude: number | null; keepEvidence?: boolean;
      }>>(`${environment.apiUrl}/api/alerts/me`)
      .pipe(map((l) => l.map((a) => ({
        id: a.id,
        status: a.status,
        method: a.activationMethod,
        start: utcDate(a.startedAt)!,
        lat: a.latitude != null ? Number(a.latitude) : null,
        lng: a.longitude != null ? Number(a.longitude) : null,
        keep: !!a.keepEvidence,
      }))));
  }

  /** Conservar (o no) las evidencias de una alerta más allá de los 60 días. */
  keep(alertId: number, keep: boolean): Observable<void> {
    return this.http
      .patch(`${environment.apiUrl}/api/alerts/${alertId}/keep-evidence`, { keep })
      .pipe(map(() => undefined));
  }

  /** Cambia el nombre que se muestra (el archivo y su huella no cambian). */
  rename(id: number, name: string): Observable<MyEvidence> {
    return this.http.patch<EvidenceViewApi>(`${this.url}/${id}/name`, { name: name }).pipe(map(fromApi));
  }

  fromApi = fromApi;
}

function fromApi(e: EvidenceViewApi): MyEvidence {
  return {
    id: e.id,
    alertId: e.alertId,
    type: e.mediaType,
    fileName: e.fileName ?? `evidencia-${e.id}`,
    contentType: e.contentType ?? '',
    sizeBytes: e.sizeBytes,
    sha256: e.sha256,
    hasFile: e.hasFile,
    date: utcDate(e.createdAt)!,
    alert: e.alert
      ? {
          id: e.alert.id,
          type: e.alert.alertType,
          method: e.alert.activationMethod,
          status: e.alert.status,
          start: utcDate(e.alert.startedAt),
          lat: e.alert.latitude != null ? Number(e.alert.latitude) : null,
          lng: e.alert.longitude != null ? Number(e.alert.longitude) : null,
        }
      : null,
  };
}
