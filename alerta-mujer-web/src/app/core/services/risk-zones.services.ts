import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ZonaManual, PuntoMapa } from '../models/zona.model';

@Injectable({ providedIn: 'root' })
export class RiskZonesService {
  private http = inject(HttpClient);
  private zonasUrl = `${environment.apiUrl}/zonasManuales`;
  private puntosUrl = `${environment.apiUrl}/puntosMapa`;

  getZonas(): Observable<ZonaManual[]> {
    return this.http.get<ZonaManual[]>(this.zonasUrl);
  }

  createZona(zona: Omit<ZonaManual, 'id'>): Observable<ZonaManual> {
    return this.http.post<ZonaManual>(this.zonasUrl, zona);
  }

  deleteZona(id: number): Observable<void> {
    return this.http.delete<void>(`${this.zonasUrl}/${id}`);
  }

  getPuntos(): Observable<PuntoMapa[]> {
    return this.http.get<PuntoMapa[]>(this.puntosUrl);
  }

  createPunto(punto: Omit<PuntoMapa, 'id'>): Observable<PuntoMapa> {
    return this.http.post<PuntoMapa>(this.puntosUrl, punto);
  }
}