import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Zona } from '../models/zone-management-model';

@Injectable({ providedIn: 'root' })
export class ZonesService {

  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000'; // usa aquí la misma URL base que en users.services.ts

  getAll(): Observable<Zona[]> {
    return this.http.get<Zona[]>(`${this.apiUrl}/zonas`);
  }

  crear(zona: Omit<Zona, 'id'>): Observable<Zona> {
    return this.http.post<Zona>(`${this.apiUrl}/zonas`, zona);
  }

  actualizar(id: string, cambios: Partial<Omit<Zona, 'id'>>): Observable<Zona> {
    return this.http.patch<Zona>(`${this.apiUrl}/zonas/${id}`, cambios);
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/zonas/${id}`);
  }
}