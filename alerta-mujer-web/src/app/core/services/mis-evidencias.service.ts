import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export type TipoEvidencia = 'photo' | 'video' | 'audio' | 'document';

/** Evidencia de la usuaria autenticada (GET /api/evidences/me). */
export interface MiEvidencia {
  id: number;
  alertId: number;
  tipo: TipoEvidencia;
  nombreArchivo: string;
  contentType: string;
  tamanoBytes: number | null;
  sha256: string | null;
  tieneArchivo: boolean;
  fecha: Date;
  alerta: {
    id: number;
    tipo: string;
    metodo: string;
    estado: string;
    inicio: Date | null;
    lat: number | null;
    lng: number | null;
  } | null;
}

export interface MiAlerta {
  id: number;
  estado: string;
  metodo: string;
  inicio: Date;
  lat: number | null;
  lng: number | null;
  /** La usuaria la marcó para que sus evidencias no se borren a los 60 días. */
  conservar: boolean;
}

interface EvidenceViewApi {
  id: number;
  alertId: number;
  mediaType: TipoEvidencia;
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
const fechaUtc = (iso: string | null | undefined): Date | null =>
  iso ? new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`) : null;

@Injectable({ providedIn: 'root' })
export class MisEvidenciasService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/evidences`;

  listar(): Observable<MiEvidencia[]> {
    return this.http.get<EvidenceViewApi[]>(`${this.url}/me`).pipe(map((l) => l.map(desdeApi)));
  }

  /** El archivo se pide con el token y se muestra como blob: nunca hay una URL pública. */
  archivo(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/file`, { responseType: 'blob' });
  }

  subir(archivo: File, alertId: number): Observable<HttpEvent<EvidenceViewApi>> {
    const form = new FormData();
    form.append('file', archivo);
    form.append('alertId', String(alertId));
    return this.http.post<EvidenceViewApi>(`${this.url}/upload`, form, { reportProgress: true, observe: 'events' });
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  misAlertas(): Observable<MiAlerta[]> {
    return this.http
      .get<Array<{
        id: number; status: string; activationMethod: string; startedAt: string;
        latitude: number | null; longitude: number | null; keepEvidence?: boolean;
      }>>(`${environment.apiUrl}/api/alerts/me`)
      .pipe(map((l) => l.map((a) => ({
        id: a.id,
        estado: a.status,
        metodo: a.activationMethod,
        inicio: fechaUtc(a.startedAt)!,
        lat: a.latitude != null ? Number(a.latitude) : null,
        lng: a.longitude != null ? Number(a.longitude) : null,
        conservar: !!a.keepEvidence,
      }))));
  }

  /** Conservar (o no) las evidencias de una alerta más allá de los 60 días. */
  conservar(alertId: number, conservar: boolean): Observable<void> {
    return this.http
      .patch(`${environment.apiUrl}/api/alerts/${alertId}/keep-evidence`, { keep: conservar })
      .pipe(map(() => undefined));
  }

  /** Cambia el nombre que se muestra (el archivo y su huella no cambian). */
  renombrar(id: number, nombre: string): Observable<MiEvidencia> {
    return this.http.patch<EvidenceViewApi>(`${this.url}/${id}/name`, { name: nombre }).pipe(map(desdeApi));
  }

  desdeApi = desdeApi;
}

function desdeApi(e: EvidenceViewApi): MiEvidencia {
  return {
    id: e.id,
    alertId: e.alertId,
    tipo: e.mediaType,
    nombreArchivo: e.fileName ?? `evidencia-${e.id}`,
    contentType: e.contentType ?? '',
    tamanoBytes: e.sizeBytes,
    sha256: e.sha256,
    tieneArchivo: e.hasFile,
    fecha: fechaUtc(e.createdAt)!,
    alerta: e.alert
      ? {
          id: e.alert.id,
          tipo: e.alert.alertType,
          metodo: e.alert.activationMethod,
          estado: e.alert.status,
          inicio: fechaUtc(e.alert.startedAt),
          lat: e.alert.latitude != null ? Number(e.alert.latitude) : null,
          lng: e.alert.longitude != null ? Number(e.alert.longitude) : null,
        }
      : null,
  };
}
