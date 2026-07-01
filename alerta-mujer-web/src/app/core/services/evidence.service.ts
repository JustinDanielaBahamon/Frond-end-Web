import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Evidencia } from '../models/evidence.model';

@Injectable({ providedIn: 'root' })
export class EvidenceService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/evidencias`;

  // Usado por ADMIN: todas las evidencias
  getAll(): Observable<Evidencia[]> {
    return this.http.get<Evidencia[]>(this.url);
  }

  // Usado por USUARIA: solo sus propias evidencias
  getByUsuario(usuarioId: number): Observable<Evidencia[]> {
    return this.http.get<Evidencia[]>(`${this.url}?usuarioId=${usuarioId}`);
  }

  getById(id: number): Observable<Evidencia> {
    return this.http.get<Evidencia>(`${this.url}/${id}`);
  }
}