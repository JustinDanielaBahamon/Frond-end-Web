import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable, of, BehaviorSubject, delay, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Evidence, EvidenceFilters, EvidenceStats } from '../models/evidence.model';

// ── Her own evidence (dashboard) ──

export type EvidenceType = 'photo' | 'video' | 'audio' | 'document';

/** Evidence of the authenticated user (GET /api/evidences/me). */
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
  /** The user marked it so its evidence is not deleted after 30 days. */
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

// The backend sends LocalDateTime in UTC without a zone
const utcDate = (iso: string | null | undefined): Date | null =>
  iso ? new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`) : null;

function ownFromApi(e: EvidenceViewApi): MyEvidence {
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

// ── Admin panel ──

/** Evidence as the backend returns it to the admin panel. */
interface AdminEvidenceApi {
  id: number;
  alertId: number;
  mediaType: string;          // photo | video | audio | document
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  hasFile: boolean;
  reviewStatus: string;       // pending | verified | rejected
  createdAt: string | null;
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
  alertStatus: string | null;
  alertActivationMethod: string | null;
  alertMessage: string | null;
  alertStartedAt: string | null;
  alertLatitude: number | null;
  alertLongitude: number | null;
}

const TYPE_FROM_API: Record<string, Evidence['type']> = {
  photo: 'foto', video: 'video', audio: 'audio', document: 'documento',
};
const STATUS_FROM_API: Record<string, Evidence['status']> = {
  pending: 'Pendiente', verified: 'Verificada', rejected: 'Rechazada',
};
const ALERT_STATUS: Record<string, string> = {
  active: 'Activa', resolved: 'Atendida', cancelled: 'Cancelada', expired: 'Expirada',
};
const ACTIVATION_METHOD: Record<string, string> = {
  panic_button: 'Botón de pánico', contact: 'Desde contactos', power_button: 'Botón de encendido', widget: 'Widget', suspicious_movement: 'Movimiento sospechoso',
};

function readableSize(bytes: number | null): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';

function fromApi(e: AdminEvidenceApi): Evidence {
  const location = e.alertLatitude != null && e.alertLongitude != null
    ? `${Number(e.alertLatitude).toFixed(5)}, ${Number(e.alertLongitude).toFixed(5)}`
    : '';
  const method = ACTIVATION_METHOD[e.alertActivationMethod ?? ''] ?? (e.alertActivationMethod ?? '');
  return {
    id: e.id,
    userId: e.userId ?? 0,
    userName: e.userName ?? 'Sin usuaria',
    userEmail: e.userEmail ?? '',
    type: TYPE_FROM_API[e.mediaType] ?? 'documento',
    name: e.fileName ?? `evidencia-${e.id}`,
    size: readableSize(e.sizeBytes),
    date: e.createdAt ?? '',
    time: time(e.createdAt),
    alertId: String(e.alertId),
    alertType: 'Alerta SOS',
    alertCity: '',
    status: STATUS_FROM_API[e.reviewStatus] ?? 'Pendiente',
    location,
    activationMethod: method,
    linkedAlert: {
      id: String(e.alertId),
      type: 'Alerta SOS',
      date: e.alertStartedAt ?? '',
      time: time(e.alertStartedAt),
      city: '',
      location,
      status: ALERT_STATUS[e.alertStatus ?? ''] ?? (e.alertStatus ?? ''),
      description: e.alertMessage ?? undefined,
      activationMethod: method,
    },
  };
}

@Injectable({ providedIn: 'root' })
export class EvidenceService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/evidences`;

  // No mock data - it is loaded from the backend
  private evidencesSubject = new BehaviorSubject<Evidence[]>([]);
  evidences$ = this.evidencesSubject.asObservable();

  private statsSubject = new BehaviorSubject<EvidenceStats>({
    totalEvidenceCount: 0,
    verified: 0,
    pending: 0,
    rejected: 0,
    downloads: 0
  });
  stats$ = this.statsSubject.asObservable();

  // Variable for the download counter
  private downloadCounter: number = 0;

  // ========================================
  // API METHODS (connect to the backend)
  // ========================================

  /**
   * Obtener todas las evidencias
   */
  getAll(): Observable<Evidence[]> {
    return this.http.get<AdminEvidenceApi[]>(this.url).pipe(
      map(list => list.map(fromApi)),
      // The local list feeds the filters and the stats
      tap(evidences => {
        this.evidencesSubject.next(evidences);
        this.updateStats();
      }),
    );
  }

  /**
   * Obtener evidencia por ID
   */
  getById(id: number): Observable<Evidence> {
    // TODO: Conectar al backend
    // return this.http.get<Evidencia>(`${this.url}/${id}`);
    const evidence = this.evidencesSubject.value.find(e => e.id === id);
    return of(evidence as Evidence).pipe(delay(300));
  }

  /**
   * Eliminar evidencia
   */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /**
   * Get stats
   */
  // Updated every time the list changes
  getStats(): Observable<EvidenceStats> {
    return this.stats$;
  }

  /**
   * Compute stats dynamically from the evidence
   */
  private computeStats(): EvidenceStats {
    const evidences = this.evidencesSubject.value;
    const total = evidences.length;
    const verified = evidences.filter(e => e.status === 'Verificada').length;
    const pending = evidences.filter(e => e.status === 'Pendiente').length;
    const rejected = evidences.filter(e => e.status === 'Rechazada').length;
    
    return {
      totalEvidenceCount: total,
      verified,
      pending,
      rejected,
      downloads: this.downloadCounter
    };
  }

  /**
   * Update stats and notify the subscribers
   */
  private updateStats(): void {
    const stats = this.computeStats();
    this.statsSubject.next(stats);
  }

  /**
   * Descargar evidencia
   */
  // Descarga el archivo real (GET /api/evidences/{id}/file?download=true)
  download(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/file`, { params: { download: 'true' }, responseType: 'blob' }).pipe(
      tap(() => {
        this.downloadCounter++;
        this.updateStats();
      }),
    );
  }

  // ========================================
  // FILTER METHODS
  // ========================================

  /**
   * Filter evidence by criteria
   */
  filterEvidences(filters: EvidenceFilters): Observable<Evidence[]> {
    let filteredEvidences = [...this.evidencesSubject.value];

    // Search filter
    if (filters.search && filters.search.trim() !== '') {
      const searchLower = filters.search.toLowerCase().trim();
      filteredEvidences = filteredEvidences.filter(evidence => {
        return (
          evidence.name.toLowerCase().includes(searchLower) ||
          evidence.alertId.toLowerCase().includes(searchLower) ||
          evidence.userName.toLowerCase().includes(searchLower) ||
          evidence.userEmail.toLowerCase().includes(searchLower) ||
          evidence.alertType.toLowerCase().includes(searchLower) ||
          evidence.alertCity.toLowerCase().includes(searchLower) ||
          (evidence.location && evidence.location.toLowerCase().includes(searchLower)) ||
          evidence.type.toLowerCase().includes(searchLower) ||
          evidence.status.toLowerCase().includes(searchLower) ||
          evidence.size.toLowerCase().includes(searchLower)
        );
      });
    }

    // Filtro por tipo
    if (filters.type && filters.type !== 'all') {
      filteredEvidences = filteredEvidences.filter(evidence =>
        evidence.type === filters.type
      );
    }

    // Filtro por estado
    if (filters.status && filters.status !== 'all') {
      filteredEvidences = filteredEvidences.filter(evidence =>
        evidence.status === filters.status
      );
    }

    // Date range filter
    if (filters.startDate) {
      filteredEvidences = filteredEvidences.filter(evidence =>
        new Date(evidence.date) >= filters.startDate!
      );
    }

    if (filters.endDate) {
      filteredEvidences = filteredEvidences.filter(evidence =>
        new Date(evidence.date) <= filters.endDate!
      );
    }

    return of(filteredEvidences).pipe(delay(200));
  }

  /**
   * Cambiar estado de evidencia
   */
  // Saves the review in the backend (PATCH /api/evidences/{id}/review)
  changeStatus(id: number, newStatus: 'Verificada' | 'Pendiente' | 'Rechazada'): Observable<Evidence> {
    const reviewStatus = { Verificada: 'verified', Pendiente: 'pending', Rechazada: 'rejected' }[newStatus];
    return this.http.patch<AdminEvidenceApi>(`${this.url}/${id}/review`, { reviewStatus }).pipe(
      map(fromApi),
      tap(updated => {
        this.evidencesSubject.next(this.evidencesSubject.value.map(e => (e.id === id ? updated : e)));
        this.updateStats();
      }),
    );
  }

  // ========================================
  // HER OWN EVIDENCE (user dashboard)
  // ========================================

  listMine(): Observable<MyEvidence[]> {
    return this.http.get<EvidenceViewApi[]>(`${this.url}/me`).pipe(map((l) => l.map(ownFromApi)));
  }

  /** The file is requested with the token and shown as a blob: there is never a public URL. */
  getFile(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/file`, { responseType: 'blob' });
  }

  upload(file: File, alertId: number): Observable<HttpEvent<EvidenceViewApi>> {
    const form = new FormData();
    form.append('file', file);
    form.append('alertId', String(alertId));
    return this.http.post<EvidenceViewApi>(`${this.url}/upload`, form, { reportProgress: true, observe: 'events' });
  }

  myAlerts(): Observable<MyAlert[]> {
    return this.http
      .get<Array<{
        id: number; status: string; activationMethod: string; startedAt: string;
        latitude: number | null; longitude: number | null; keepEvidence?: boolean; duressAt?: string | null;
      }>>(`${environment.apiUrl}/api/alerts/me`)
      .pipe(map((l) => l.map((a) => ({
        id: a.id,
        // Cancelled with the duress PIN: it keeps running, but on her screens it looks cancelled
        status: a.duressAt ? 'cancelled' : a.status,
        method: a.activationMethod,
        start: utcDate(a.startedAt)!,
        lat: a.latitude != null ? Number(a.latitude) : null,
        lng: a.longitude != null ? Number(a.longitude) : null,
        keep: !!a.keepEvidence,
      }))));
  }

  /** Keep (or not) the evidence of an alert beyond 30 days. */
  keep(alertId: number, keep: boolean): Observable<void> {
    return this.http
      .patch(`${environment.apiUrl}/api/alerts/${alertId}/keep-evidence`, { keep })
      .pipe(map(() => undefined));
  }

  /** Changes the displayed name (the file and its fingerprint do not change). */
  rename(id: number, name: string): Observable<MyEvidence> {
    return this.http.patch<EvidenceViewApi>(`${this.url}/${id}/name`, { name: name }).pipe(map(ownFromApi));
  }

  ownFromApi = ownFromApi;
}
