import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

import { Zona } from '../models/zone-management-model';

@Injectable({ providedIn: 'root' })
export class ZonesService {

  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(): Observable<Zona[]> {
    return this.http.get<Zona[]>(`${this.apiUrl}/api/zones`);
  }

  crear(zona: Omit<Zona, 'id'>): Observable<Zona> {
    return this.http.post<Zona>(`${this.apiUrl}/api/zones`, zona);
  }

  actualizar(id: string, cambios: Partial<Omit<Zona, 'id'>>): Observable<Zona> {
    return this.http.put<Zona>(`${this.apiUrl}/api/zones/${id}`, cambios);
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/zones/${id}`);
  }
}