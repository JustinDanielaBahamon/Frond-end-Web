import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ContactoEmergencia, EmergencyContactApi } from '../models/emergency-contact.model';

@Injectable({ providedIn: 'root' })
export class EmergencyContactService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/contacts`;

  // Transforma EmergencyContactApi del backend a ContactoEmergencia del frontend
  private mapApiToContact(api: EmergencyContactApi): ContactoEmergencia {
    return {
      id: api.id,
      usuarioId: api.userProfileId,
      nombre: api.contactName,
      telefono: api.telephone,
      email: api.email,
      relacion: api.relationship || 'Otro',
      activo: true, // El backend no tiene campo activo, valor por defecto
    };
  }

  // Transforma ContactoEmergencia del frontend al formato del backend
  private mapContactToApi(contacto: Omit<ContactoEmergencia, 'id'>): any {
    return {
      // No enviamos userProfileId, el backend lo establece automáticamente
      contactName: contacto.nombre,
      telephone: contacto.telefono,
      // El correo es el canal por el que el contacto recibe el aviso cuando se activa una alerta
      email: contacto.email?.trim() || null,
      relationship: contacto.relacion,
    };
  }

  getByUsuario(usuarioId: number): Observable<ContactoEmergencia[]> {
    return this.http.get<EmergencyContactApi[]>(`${this.url}/user/${usuarioId}`).pipe(
      map(contacts => contacts.map(c => this.mapApiToContact(c)))
    );
  }

  create(contacto: Omit<ContactoEmergencia, 'id'>): Observable<ContactoEmergencia> {
    const apiData = this.mapContactToApi(contacto);
    return this.http.post<EmergencyContactApi>(this.url, apiData).pipe(
      map(api => this.mapApiToContact(api))
    );
  }

  update(id: number, contacto: Partial<ContactoEmergencia>): Observable<ContactoEmergencia> {
    const apiData: any = {};
    if (contacto.nombre !== undefined) apiData.contactName = contacto.nombre;
    if (contacto.telefono !== undefined) apiData.telephone = contacto.telefono;
    if (contacto.relacion !== undefined) apiData.relationship = contacto.relacion;
    if (contacto.email !== undefined) apiData.email = contacto.email?.trim() || null;
    // El backend expone PUT (no PATCH) y solo cambia los campos enviados
    return this.http.put<EmergencyContactApi>(`${this.url}/${id}`, apiData).pipe(
      map(api => this.mapApiToContact(api))
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}