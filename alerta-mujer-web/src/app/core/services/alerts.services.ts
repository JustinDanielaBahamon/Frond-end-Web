import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Alerta, EstadoAlerta, MedioActivacion } from '../models/alert.model';

@Injectable({ providedIn: 'root' })
export class AlertsService {
  private http = inject(HttpClient);
  // Usado por ADMIN: todas las alertas
  getAll(): Observable<Alerta[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/api/admin/alerts`).pipe(
      map(lista => lista.map(a => this.normalizar(a)))
    );
  }

  // Usado por USUARIA: solo sus propias alertas
  getByUsuario(usuarioId: number): Observable<Alerta[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/api/alerts/user/${usuarioId}`).pipe(
      map(lista => lista.map(a => this.normalizar(a)))
    );
  }

  getById(id: number): Observable<Alerta> {
    return this.http.get<any>(`${environment.apiUrl}/api/alerts/${id}`).pipe(
      map(a => this.normalizar(a))
    );
  }

  update(alerta: Alerta): Observable<Alerta> {
    return this.http.put<any>(`${environment.apiUrl}/api/alerts/${alerta.id}`, alerta).pipe(
      map(a => this.normalizar(a))
    );
  }

  // Cambia solo el estado sin pisar los demás campos
  updateEstado(id: number, estado: EstadoAlerta): Observable<Alerta> {
    return this.http.put<any>(`${environment.apiUrl}/api/alerts/${id}`, { status: this.mapearEstadoBackend(estado) }).pipe(
      map(a => this.normalizar(a))
    );
  }

  // ── Normalización ──────────────────────────────────────────────
  // Adapta lo que venga de db.json a la forma de la interfaz Alerta.
  // Ajusta los nombres alternativos según lo que veas en el console.log.
  private normalizar(a: any): Alerta {
    return {
      id: a.id,
      nombre: a.nombre ?? a.usuaria ?? a.user_name ?? 'Sin nombre',
      descripcion: a.descripcion ?? a.description ?? a.tipo ?? '',
      medioActivacion: this.normalizarMedio(a.medioActivacion ?? a.activationMethod ?? a.medio),
      tiempo: a.tiempo ?? this.haceCuanto(a.createdAt ?? a.created_at ?? a.startedAt ?? a.started_at),
      ubicacion: a.ubicacion ?? a.message ?? a.location ?? '',
      lat: Number(a.lat ?? a.latitude ?? 0) || 0,
      lng: Number(a.lng ?? a.longitude ?? 0) || 0,
      estado: this.normalizarEstado(a.estado ?? a.status),
      usuarioId: a.usuarioId ?? a.userProfileId,
      tipo: a.tipo ?? a.alertType,
      created_at: a.created_at ?? a.createdAt,
      started_at: a.started_at ?? a.startedAt,
    };
  }

  private normalizarMedio(valor: unknown): MedioActivacion {
    const v = String(valor ?? '').toLowerCase();
    if (v.includes('widget')) return 'Widget';
    if (v.includes('mov') || v.includes('sospech') || v.includes('sacud') || v.includes('agit')) return 'Movimiento sospechoso';
    if (v.includes('manual')) return 'Manual';
    return 'Botón de pánico';
  }

  private mapearEstadoBackend(estado?: EstadoAlerta): string {
    const v = String(estado ?? '').toLowerCase();
    if (v.includes('atendida')) return 'resolved';
    if (v.includes('cancelada')) return 'cancelled';
    return 'active';
  }

  private normalizarEstado(valor: unknown): EstadoAlerta {
    const v = String(valor ?? '').toLowerCase();
    if (v.startsWith('atend') || v === 'resolved' || v === 'attended') return 'Atendida';
    if (v.startsWith('cancel')) return 'Cancelada';
    return 'Pendiente';
  }

  private haceCuanto(fecha?: string): string {
    if (!fecha) return '';
    const isoUtc = fecha + (fecha.endsWith('Z') || fecha.includes('+') ? '' : 'Z');
    const t = new Date(isoUtc).getTime();
    if (isNaN(t)) return '';
    const min = Math.round((Date.now() - t) / 60000);
    if (min < 1) return 'Ahora';
    if (min < 60) return `Hace ${min} min`;
    if (min < 1440) return `Hace ${Math.round(min / 60)} h`;
    return `Hace ${Math.round(min / 1440)} d`;
  }
}