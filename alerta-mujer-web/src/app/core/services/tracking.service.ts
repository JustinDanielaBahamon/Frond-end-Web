import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { aServicio } from '../api/servicios';
import { environment } from '../../../environments/environment';

export interface PuntoSeguimiento {
  lat: number;
  lng: number;
  precision: number | null;
  hora: Date;
}

/** Video, audio o foto grabado durante la alerta (se abre con un enlace que vence en minutos). */
export interface EvidenciaSeguimiento {
  id: number;
  tipo: 'video' | 'audio' | 'photo' | 'document';
  contentType: string;
  creada: Date | null;
  url: string;
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
  evidencias: EvidenciaSeguimiento[];
}

/** Mensaje del chat de la alerta. deElla: lo escribió quien activó la alerta. */
export interface MensajeAlerta {
  id: number;
  deElla: boolean;
  nombre: string;
  texto: string;
  hora: Date;
}

const aMensaje = (m: any): MensajeAlerta => ({
  id: m.id,
  deElla: m.senderType === 'owner',
  nombre: m.senderName,
  texto: m.body,
  hora: new Date(m.createdAt),
});

@Injectable({ providedIn: 'root' })
export class TrackingService {
  private http = inject(HttpClient);

  consultar(codigo: string): Observable<Seguimiento> {
    // v: identificador anónimo de este navegador, para que la usuaria sepa que alguien abrió su alerta
    return this.http.get<any>(`${environment.apiUrl}/api/public/tracking/${encodeURIComponent(codigo)}`, {
      params: { v: visitante() },
    }).pipe(
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
        numeroEmergencia: t.emergencyNumber || '123',
        evidencias: (t.evidence ?? []).map((e: any) => ({
          id: e.id,
          tipo: e.mediaType,
          contentType: e.contentType,
          creada: e.createdAt ? new Date(e.createdAt) : null,
          url: aServicio(`${environment.apiUrl}/api/public/tracking/${encodeURIComponent(codigo)}/evidence/${e.id}`)
        }))
      }))
    );
  }

  /** Mensajes del chat posteriores a despuesDe (0 = todos). */
  mensajes(codigo: string, despuesDe = 0): Observable<MensajeAlerta[]> {
    return this.http
      .get<any[]>(`${environment.apiUrl}/api/public/tracking/${encodeURIComponent(codigo)}/messages`, {
        params: { after: despuesDe },
      })
      .pipe(map((lista) => (lista ?? []).map(aMensaje)));
  }

  enviarMensaje(codigo: string, nombre: string, texto: string): Observable<MensajeAlerta> {
    return this.http
      .post<any>(`${environment.apiUrl}/api/public/tracking/${encodeURIComponent(codigo)}/messages`, {
        name: nombre,
        body: texto,
      })
      .pipe(map(aMensaje));
  }
}

const CLAVE_VISITANTE = 'alerta-mujer-visitante';

/** Identificador anónimo y estable de este navegador (no contiene datos personales). */
function visitante(): string {
  try {
    let id = localStorage.getItem(CLAVE_VISITANTE);
    if (!id) {
      id = 'web-' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      localStorage.setItem(CLAVE_VISITANTE, id);
    }
    return id;
  } catch {
    return 'web-sin-almacenamiento';
  }
}
