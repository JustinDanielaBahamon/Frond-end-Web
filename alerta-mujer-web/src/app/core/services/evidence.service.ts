import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject, delay, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Evidence, EvidenceFilters, EvidenceStats } from '../models/evidence.model';

/** Evidencia tal como la devuelve el backend al panel de administración. */
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

const TYPE_FROM_API: Record<string, Evidence['tipo']> = {
  photo: 'foto', video: 'video', audio: 'audio', document: 'documento',
};
const STATUS_FROM_API: Record<string, Evidence['estado']> = {
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
    tipo: TYPE_FROM_API[e.mediaType] ?? 'documento',
    nombre: e.fileName ?? `evidencia-${e.id}`,
    size: readableSize(e.sizeBytes),
    fecha: e.createdAt ?? '',
    time: time(e.createdAt),
    alertaId: String(e.alertId),
    alertType: 'Alerta SOS',
    alertCity: '',
    estado: STATUS_FROM_API[e.reviewStatus] ?? 'Pendiente',
    location,
    activationMethod: method,
    linkedAlert: {
      id: String(e.alertId),
      tipo: 'Alerta SOS',
      fecha: e.alertStartedAt ?? '',
      time: time(e.alertStartedAt),
      city: '',
      location,
      estado: ALERT_STATUS[e.alertStatus ?? ''] ?? (e.alertStatus ?? ''),
      description: e.alertMessage ?? undefined,
      activationMethod: method,
    },
  };
}

@Injectable({ providedIn: 'root' })
export class EvidenceService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/evidences`;

  // Sin datos mock - se cargarán desde el backend
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

  // Variable para el contador de descargas
  private downloadCounter: number = 0;

  // ========================================
  // MÉTODOS API (Conectar al backend)
  // ========================================

  /**
   * Obtener todas las evidencias
   */
  getAll(): Observable<Evidence[]> {
    return this.http.get<AdminEvidenceApi[]>(this.url).pipe(
      map(list => list.map(fromApi)),
      // La lista local alimenta los filtros y las estadísticas
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
   * Obtener estadísticas
   */
  // Se actualiza cada vez que cambia la lista
  getStats(): Observable<EvidenceStats> {
    return this.stats$;
  }

  /**
   * Calcular estadísticas dinámicamente desde las evidencias
   */
  private computeStats(): EvidenceStats {
    const evidences = this.evidencesSubject.value;
    const total = evidences.length;
    const verified = evidences.filter(e => e.estado === 'Verificada').length;
    const pending = evidences.filter(e => e.estado === 'Pendiente').length;
    const rejected = evidences.filter(e => e.estado === 'Rechazada').length;
    
    return {
      totalEvidenceCount: total,
      verified,
      pending,
      rejected,
      downloads: this.downloadCounter
    };
  }

  /**
   * Actualizar estadísticas y notificar a los suscriptores
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
  // MÉTODOS DE FILTRADO
  // ========================================

  /**
   * Filtrar evidencias según criterios
   */
  filterEvidences(filters: EvidenceFilters): Observable<Evidence[]> {
    let filteredEvidences = [...this.evidencesSubject.value];

    // Filtro de búsqueda
    if (filters.search && filters.search.trim() !== '') {
      const searchLower = filters.search.toLowerCase().trim();
      filteredEvidences = filteredEvidences.filter(evidence => {
        return (
          evidence.nombre.toLowerCase().includes(searchLower) ||
          evidence.alertaId.toLowerCase().includes(searchLower) ||
          evidence.userName.toLowerCase().includes(searchLower) ||
          evidence.userEmail.toLowerCase().includes(searchLower) ||
          evidence.alertType.toLowerCase().includes(searchLower) ||
          evidence.alertCity.toLowerCase().includes(searchLower) ||
          (evidence.location && evidence.location.toLowerCase().includes(searchLower)) ||
          evidence.tipo.toLowerCase().includes(searchLower) ||
          evidence.estado.toLowerCase().includes(searchLower) ||
          evidence.size.toLowerCase().includes(searchLower)
        );
      });
    }

    // Filtro por tipo
    if (filters.tipo && filters.tipo !== 'all') {
      filteredEvidences = filteredEvidences.filter(evidence =>
        evidence.tipo === filters.tipo
      );
    }

    // Filtro por estado
    if (filters.estado && filters.estado !== 'all') {
      filteredEvidences = filteredEvidences.filter(evidence =>
        evidence.estado === filters.estado
      );
    }

    // Filtro por rango de fechas
    if (filters.startDate) {
      filteredEvidences = filteredEvidences.filter(evidence =>
        new Date(evidence.fecha) >= filters.startDate!
      );
    }

    if (filters.endDate) {
      filteredEvidences = filteredEvidences.filter(evidence =>
        new Date(evidence.fecha) <= filters.endDate!
      );
    }

    return of(filteredEvidences).pipe(delay(200));
  }

  /**
   * Cambiar estado de evidencia
   */
  // Guarda la revisión en el backend (PATCH /api/evidences/{id}/review)
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
}
