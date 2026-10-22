import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject, delay, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Evidencia, EvidenciaFilters, EvidenciaStats } from '../models/evidence.model';

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

const TIPO_DESDE_API: Record<string, Evidencia['tipo']> = {
  photo: 'foto', video: 'video', audio: 'audio', document: 'documento',
};
const ESTADO_DESDE_API: Record<string, Evidencia['estado']> = {
  pending: 'Pendiente', verified: 'Verificada', rejected: 'Rechazada',
};
const ESTADO_ALERTA: Record<string, string> = {
  active: 'Activa', resolved: 'Atendida', cancelled: 'Cancelada', expired: 'Expirada',
};
const METODO_ACTIVACION: Record<string, string> = {
  panic_button: 'Botón de pánico', contact: 'Desde contactos', power_button: 'Botón de encendido', widget: 'Widget', suspicious_movement: 'Movimiento sospechoso',
};

function tamanioLegible(bytes: number | null): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';

function desdeApi(e: AdminEvidenceApi): Evidencia {
  const ubicacion = e.alertLatitude != null && e.alertLongitude != null
    ? `${Number(e.alertLatitude).toFixed(5)}, ${Number(e.alertLongitude).toFixed(5)}`
    : '';
  const metodo = METODO_ACTIVACION[e.alertActivationMethod ?? ''] ?? (e.alertActivationMethod ?? '');
  return {
    id: e.id,
    usuarioId: e.userId ?? 0,
    usuarioNombre: e.userName ?? 'Sin usuaria',
    usuarioEmail: e.userEmail ?? '',
    tipo: TIPO_DESDE_API[e.mediaType] ?? 'documento',
    nombre: e.fileName ?? `evidencia-${e.id}`,
    tamanio: tamanioLegible(e.sizeBytes),
    fecha: e.createdAt ?? '',
    hora: hora(e.createdAt),
    alertaId: String(e.alertId),
    alertaTipo: 'Alerta SOS',
    alertaCiudad: '',
    estado: ESTADO_DESDE_API[e.reviewStatus] ?? 'Pendiente',
    ubicacion,
    metodoActivacion: metodo,
    alertaAsociada: {
      id: String(e.alertId),
      tipo: 'Alerta SOS',
      fecha: e.alertStartedAt ?? '',
      hora: hora(e.alertStartedAt),
      ciudad: '',
      ubicacion,
      estado: ESTADO_ALERTA[e.alertStatus ?? ''] ?? (e.alertStatus ?? ''),
      descripcion: e.alertMessage ?? undefined,
      metodoActivacion: metodo,
    },
  };
}

@Injectable({ providedIn: 'root' })
export class EvidenceService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/evidences`;

  // Sin datos mock - se cargarán desde el backend
  private evidenciasSubject = new BehaviorSubject<Evidencia[]>([]);
  evidencias$ = this.evidenciasSubject.asObservable();

  private statsSubject = new BehaviorSubject<EvidenciaStats>({
    totalEvidencias: 0,
    verificadas: 0,
    pendientes: 0,
    rechazadas: 0,
    descargas: 0
  });
  stats$ = this.statsSubject.asObservable();

  // Variable para el contador de descargas
  private contadorDescargas: number = 0;

  // ========================================
  // MÉTODOS API (Conectar al backend)
  // ========================================

  /**
   * Obtener todas las evidencias
   */
  getAll(): Observable<Evidencia[]> {
    return this.http.get<AdminEvidenceApi[]>(this.url).pipe(
      map(lista => lista.map(desdeApi)),
      // La lista local alimenta los filtros y las estadísticas
      tap(evidencias => {
        this.evidenciasSubject.next(evidencias);
        this.actualizarEstadisticas();
      }),
    );
  }

  /**
   * Obtener evidencia por ID
   */
  getById(id: number): Observable<Evidencia> {
    // TODO: Conectar al backend
    // return this.http.get<Evidencia>(`${this.url}/${id}`);
    const evidencia = this.evidenciasSubject.value.find(e => e.id === id);
    return of(evidencia as Evidencia).pipe(delay(300));
  }

  /**
   * Crear nueva evidencia
   */
  create(evidencia: Omit<Evidencia, 'id'>): Observable<Evidencia> {
    return this.http.post<Evidencia>(this.url, evidencia);
  }

  /**
   * Actualizar evidencia
   */
  update(id: number, evidencia: Evidencia): Observable<Evidencia> {
    return this.http.put<Evidencia>(`${this.url}/${id}`, evidencia);
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
  getStats(): Observable<EvidenciaStats> {
    return this.stats$;
  }

  /**
   * Calcular estadísticas dinámicamente desde las evidencias
   */
  private calcularEstadisticas(): EvidenciaStats {
    const evidencias = this.evidenciasSubject.value;
    const total = evidencias.length;
    const verificadas = evidencias.filter(e => e.estado === 'Verificada').length;
    const pendientes = evidencias.filter(e => e.estado === 'Pendiente').length;
    const rechazadas = evidencias.filter(e => e.estado === 'Rechazada').length;
    
    return {
      totalEvidencias: total,
      verificadas: verificadas,
      pendientes: pendientes,
      rechazadas: rechazadas,
      descargas: this.contadorDescargas
    };
  }

  /**
   * Actualizar estadísticas y notificar a los suscriptores
   */
  private actualizarEstadisticas(): void {
    const stats = this.calcularEstadisticas();
    this.statsSubject.next(stats);
  }

  /**
   * Descargar evidencia
   */
  // Descarga el archivo real (GET /api/evidences/{id}/file?download=true)
  descargar(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/file`, { params: { download: 'true' }, responseType: 'blob' }).pipe(
      tap(() => {
        this.contadorDescargas++;
        this.actualizarEstadisticas();
      }),
    );
  }

  // ========================================
  // MÉTODOS DE FILTRADO
  // ========================================

  /**
   * Filtrar evidencias según criterios
   */
  filtrarEvidencias(filtros: EvidenciaFilters): Observable<Evidencia[]> {
    let evidenciasFiltradas = [...this.evidenciasSubject.value];

    // Filtro de búsqueda
    if (filtros.busqueda && filtros.busqueda.trim() !== '') {
      const busquedaLower = filtros.busqueda.toLowerCase().trim();
      evidenciasFiltradas = evidenciasFiltradas.filter(evidencia => {
        return (
          evidencia.nombre.toLowerCase().includes(busquedaLower) ||
          evidencia.alertaId.toLowerCase().includes(busquedaLower) ||
          evidencia.usuarioNombre.toLowerCase().includes(busquedaLower) ||
          evidencia.usuarioEmail.toLowerCase().includes(busquedaLower) ||
          evidencia.alertaTipo.toLowerCase().includes(busquedaLower) ||
          evidencia.alertaCiudad.toLowerCase().includes(busquedaLower) ||
          (evidencia.ubicacion && evidencia.ubicacion.toLowerCase().includes(busquedaLower)) ||
          evidencia.tipo.toLowerCase().includes(busquedaLower) ||
          evidencia.estado.toLowerCase().includes(busquedaLower) ||
          evidencia.tamanio.toLowerCase().includes(busquedaLower)
        );
      });
    }

    // Filtro por tipo
    if (filtros.tipo && filtros.tipo !== 'all') {
      evidenciasFiltradas = evidenciasFiltradas.filter(evidencia =>
        evidencia.tipo === filtros.tipo
      );
    }

    // Filtro por estado
    if (filtros.estado && filtros.estado !== 'all') {
      evidenciasFiltradas = evidenciasFiltradas.filter(evidencia =>
        evidencia.estado === filtros.estado
      );
    }

    // Filtro por rango de fechas
    if (filtros.fechaInicio) {
      evidenciasFiltradas = evidenciasFiltradas.filter(evidencia =>
        new Date(evidencia.fecha) >= filtros.fechaInicio!
      );
    }

    if (filtros.fechaFin) {
      evidenciasFiltradas = evidenciasFiltradas.filter(evidencia =>
        new Date(evidencia.fecha) <= filtros.fechaFin!
      );
    }

    return of(evidenciasFiltradas).pipe(delay(200));
  }

  /**
   * Cambiar estado de evidencia
   */
  // Guarda la revisión en el backend (PATCH /api/evidences/{id}/review)
  cambiarEstado(id: number, nuevoEstado: 'Verificada' | 'Pendiente' | 'Rechazada'): Observable<Evidencia> {
    const reviewStatus = { Verificada: 'verified', Pendiente: 'pending', Rechazada: 'rejected' }[nuevoEstado];
    return this.http.patch<AdminEvidenceApi>(`${this.url}/${id}/review`, { reviewStatus }).pipe(
      map(desdeApi),
      tap(actualizada => {
        this.evidenciasSubject.next(this.evidenciasSubject.value.map(e => (e.id === id ? actualizada : e)));
        this.actualizarEstadisticas();
      }),
    );
  }
}
