import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Alerta } from '../models/alert.model';

@Injectable({ providedIn: 'root' })
export class AlertsService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/alertas`;

  getAll(): Observable<Alerta[]> {
    return this.http.get<Alerta[]>(this.url);
  }

  update(alerta: Alerta): Observable<Alerta> {
    return this.http.put<Alerta>(`${this.url}/${alerta.id}`, alerta);
  }
}