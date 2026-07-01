import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Alerta } from '../models/alert.model';

@Injectable({ providedIn: 'root' })
export class AlertsService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/alertas`;

  // Usado por ADMIN: todas las alertas
  getAll(): Observable<Alerta[]> {
    return this.http.get<Alerta[]>(this.url);
  }

  // Usado por USUARIA: solo sus propias alertas
  // json-server soporta filtros por query param: /alertas?usuarioId=1
  getByUsuario(usuarioId: number): Observable<Alerta[]> {
    return this.http.get<Alerta[]>(`${this.url}?usuarioId=${usuarioId}`);
  }

  getById(id: number): Observable<Alerta> {
    return this.http.get<Alerta>(`${this.url}/${id}`);
  }

  update(alerta: Alerta): Observable<Alerta> {
    return this.http.put<Alerta>(`${this.url}/${alerta.id}`, alerta);
  }
}