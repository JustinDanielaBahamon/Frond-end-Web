import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LineaAyuda, CentroAyuda, RecursoGuardado } from '../models/assistance.model';

@Injectable({ providedIn: 'root' })
export class AssistanceService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getLineas(): Observable<LineaAyuda[]> {
    return this.http.get<LineaAyuda[]>(`${this.base}/lineas-ayuda`);
  }

  getCentros(): Observable<CentroAyuda[]> {
    return this.http.get<CentroAyuda[]>(`${this.base}/centros-ayuda`);
  }

  getRecursosGuardados(usuarioId: number): Observable<RecursoGuardado[]> {
    return this.http.get<RecursoGuardado[]>(`${this.base}/recursos-guardados?usuarioId=${usuarioId}`);
  }

  guardarRecurso(recurso: Omit<RecursoGuardado, 'id'>): Observable<RecursoGuardado> {
    return this.http.post<RecursoGuardado>(`${this.base}/recursos-guardados`, recurso);
  }

  quitarRecurso(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/recursos-guardados/${id}`);
  }
}