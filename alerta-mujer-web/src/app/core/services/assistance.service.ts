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
    return this.http.get<LineaAyuda[]>(`${this.base}/api/resources`);
  }

  getCentros(): Observable<CentroAyuda[]> {
    return this.http.get<CentroAyuda[]>(`${this.base}/api/resources`);
  }

  getRecursosGuardados(usuarioId: number): Observable<RecursoGuardado[]> {
    return this.http.get<RecursoGuardado[]>(`${this.base}/api/resource-calls/user/${usuarioId}`);
  }

  guardarRecurso(recurso: Omit<RecursoGuardado, 'id'>): Observable<RecursoGuardado> {
    return this.http.post<RecursoGuardado>(`${this.base}/api/resource-calls`, recurso);
  }

  quitarRecurso(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/resource-calls/${id}`);
  }
}