import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UbicacionEntry } from '../../core/models/location.model';

@Injectable({ providedIn: 'root' })
export class PhoneLocationService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/ubicaciones`;

  // Usado por ADMIN: todas las ubicaciones
  getAll(): Observable<UbicacionEntry[]> {
    return this.http.get<UbicacionEntry[]>(this.url);
  }

  // Usado por USUARIA: solo su propio historial de ubicaciones
  getByUsuario(usuarioId: number): Observable<UbicacionEntry[]> {
    return this.http.get<UbicacionEntry[]>(`${this.url}?usuarioId=${usuarioId}`);
  }
}