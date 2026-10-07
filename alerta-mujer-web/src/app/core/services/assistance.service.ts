import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { LineaAyuda, CentroAyuda, RecursoGuardado, TipoLinea, CategoriaCentro } from '../models/assistance.model';

@Injectable({ providedIn: 'root' })
export class AssistanceService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getLineas(): Observable<LineaAyuda[]> {
    return this.http.get<any[]>(`${this.base}/api/resources`).pipe(
      map((list) =>
        list
          .filter((r) => String(r.resourceType ?? '') === 'emergency_line' || String(r.resourceType ?? '') === 'health_center' || (r.telephone && !r.city) || r.resourceType === 'emergency_line')
          .map((r) => this.toLineaAyuda(r)),
      ),
    );
  }

  getCentros(): Observable<CentroAyuda[]> {
    return this.http.get<any[]>(`${this.base}/api/resources`).pipe(
      map((list) =>
        list
          .filter((r) => this.hasCentroFields(r))
          .map((r) => this.toCentroAyuda(r)),
      ),
    );
  }

  getRecursosGuardados(usuarioId: number): Observable<RecursoGuardado[]> {
    return this.http.get<any[]>(`${this.base}/api/resource-calls/user/${usuarioId}`).pipe(
      map((list) => list.map((c) => this.toRecursoGuardado(c))),
    );
  }

  guardarRecurso(recurso: Omit<RecursoGuardado, 'id'>): Observable<RecursoGuardado> {
    return this.http.post<any>(`${this.base}/api/resource-calls`, recurso).pipe(map((c) => this.toRecursoGuardado(c)));
  }

  quitarRecurso(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/resource-calls/${id}`);
  }

  private hasCentroFields(r: any): boolean {
    const t = String(r.resourceType ?? r.resource_type ?? '');
    return (
      t === 'police_station' || t === 'support_organization' || t === 'hospital' || t === 'police_post' ||
      t === 'health_center' || (!!r.city && !!r.address)
    );
  }

  private toLineaAyuda(r: any): LineaAyuda {
    return {
      id: Number(r.id ?? 0),
      nombre: r.name ?? r.nombre ?? '',
      numero: r.telephone ?? r.telefono ?? r.numero ?? '',
      descripcion: r.description ?? r.descripcion ?? '',
      disponibilidad: (r.isActive ?? r.activo ?? true) ? 'Disponible 24/7' : 'Horario limitado',
      tipo: this.inferTipoLinea(r),
    };
  }

  private toCentroAyuda(r: any): CentroAyuda {
    return {
      id: Number(r.id ?? 0),
      nombre: r.name ?? r.nombre ?? '',
      descripcion: r.description ?? r.descripcion ?? '',
      categoria: this.inferCategoriaCentro(r),
      distanciaKm: 0,
      estado: 'Horario no especificado',
      abierto: Boolean(r.isActive ?? true),
      lat: Number(r.latitude ?? r.lat ?? 0),
      lng: Number(r.longitude ?? r.lng ?? 0),
      address: r.address ?? r.direccion ?? '',
      city: r.city ?? r.ciudad ?? '',
    };
  }

  private toRecursoGuardado(c: any): RecursoGuardado {
    return {
      id: Number(c.id ?? 0),
      usuarioId: Number(c.userProfileId ?? c.usuarioId ?? 0),
      refTipo: 'centro',
      refId: Number(c.emergencyResourceId ?? c.refId ?? 0),
      nombre: `Llamada a recurso #${c.emergencyResourceId ?? c.refId ?? ''}`,
      subtitulo: c.telephoneDialed ? `Número: ${c.telephoneDialed}` : `Estado: ${c.status ?? ''}`,
    };
  }

  private inferTipoLinea(r: any): TipoLinea {
    const t = `${String(r.name ?? '')} ${String(r.description ?? '')}`.toLowerCase();
    if (t.includes('emergenc') || t.includes('123') || t.includes('urgencia')) return 'emergencia';
    if (t.includes('polic')) return 'policia';
    if (t.includes('bomberos') || t.includes('incendio')) return 'bomberos';
    if (t.includes('mujer') || t.includes('púrpura') || t.includes('purpura')) return 'mujeres';
    if (t.includes('defensor')) return 'defensoria';
    if (t.includes('mental') || t.includes('psico')) return 'saludMental';
    return 'emergencia';
  }

  private inferCategoriaCentro(r: any): CategoriaCentro {
    const t = `${String(r.name ?? '')} ${String(r.description ?? '')} ${String(r.resourceType ?? '')}`.toLowerCase();
    if (t.includes('mujer')) return 'mujeres';
    if (t.includes('polic') || t.includes('seguridad') || t.includes('cai')) return 'seguridad';
    if (t.includes('salud') || t.includes('hospital')) return 'salud';
    if (t.includes('legal') || t.includes('defensor')) return 'legal';
    if (t.includes('psico')) return 'psicologico';
    if (t.includes('refugio') || t.includes('albergue')) return 'refugios';
    return 'mujeres';
  }
}
