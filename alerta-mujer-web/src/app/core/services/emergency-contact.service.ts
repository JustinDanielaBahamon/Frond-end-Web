import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ContactoEmergencia } from '../models/emergency-contact.model';

@Injectable({ providedIn: 'root' })
export class EmergencyContactService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/contacts`;

  getByUsuario(usuarioId: number): Observable<ContactoEmergencia[]> {
    return this.http.get<any[]>(`${this.url}/user/${usuarioId}`).pipe(
      map((lista) => lista.map((c) => this.normalizar(c))),
    );
  }

  create(contacto: Omit<ContactoEmergencia, 'id'>): Observable<ContactoEmergencia> {
    const payload = {
      userProfileId: contacto.usuarioId,
      contactName: contacto.nombre,
      telephone: contacto.telefono,
      relationship: contacto.relacion,
    };
    return this.http.post<any>(this.url, payload).pipe(map((c) => this.normalizar(c)));
  }

  update(id: number, contacto: Partial<ContactoEmergencia>): Observable<ContactoEmergencia> {
    const payload: Record<string, unknown> = {};
    if (contacto.nombre !== undefined) payload['contactName'] = contacto.nombre;
    if (contacto.telefono !== undefined) payload['telephone'] = contacto.telefono;
    if (contacto.relacion !== undefined) payload['relationship'] = contacto.relacion;
    if (contacto.usuarioId !== undefined) payload['userProfileId'] = contacto.usuarioId;
    return this.http.put<any>(`${this.url}/${id}`, payload).pipe(map((c) => this.normalizar(c)));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  private normalizar(c: any): ContactoEmergencia {
    return {
      id: Number(c.id ?? 0),
      usuarioId: Number(c.userProfileId ?? c.usuarioId ?? 0),
      nombre: c.contactName ?? c.nombre ?? c.contact_name ?? '',
      telefono: c.telephone ?? c.telefono ?? '',
      relacion: c.relationship ?? c.relacion ?? c.parentesco ?? '',
      prioridad: Number(c.prioridad ?? 1),
      activo: c.activo === undefined ? true : Boolean(c.activo),
      creadoEn: c.createdAt ?? c.created_at,
    };
  }
}
