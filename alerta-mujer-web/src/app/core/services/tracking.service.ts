import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PuntoSeguimiento {
  lat: number;
  lng: number;
  precision: number | null;
  hora: Date;
}

/** Lo que ve un contacto de emergencia desde el enlace del correo (sin iniciar sesión). */
export interface Seguimiento {
  nombre: string;
  activa: boolean;
  estado: string;
  inicio: Date | null;
  fin: Date | null;
  recorrido: PuntoSeguimiento[];
  numeroEmergencia: string;
}

@Injectable({ providedIn: 'root' })
export class TrackingService {
  private http = inject(HttpClient);

  consultar(codigo: string): Observable<Seguimiento> {
    return this.http.get<any>(`${environment.apiUrl}/api/public/tracking/${encodeURIComponent(codigo)}`).pipe(
      map(t => ({
        nombre: t.firstName || 'Una persona',
        activa: !!t.active,
        estado: t.status,
        inicio: t.startedAt ? new Date(t.startedAt) : null,
        fin: t.endedAt ? new Date(t.endedAt) : null,
        recorrido: (t.route ?? []).map((p: any) => ({
          lat: Number(p.latitude),
          lng: Number(p.longitude),
          precision: p.accuracy != null ? Number(p.accuracy) : null,
          hora: new Date(p.recordedAt)
        })),
        numeroEmergencia: t.emergencyNumber || '123'
      }))
    );
  }
}
