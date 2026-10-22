import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EmergencyContact, EmergencyContactApi } from '../models/emergency-contact.model';

@Injectable({ providedIn: 'root' })
export class EmergencyContactService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/api/contacts`;

  // Transforma EmergencyContactApi del backend a ContactoEmergencia del frontend
  private mapApiToContact(api: EmergencyContactApi): EmergencyContact {
    return {
      id: api.id,
      userId: api.userProfileId,
      nombre: api.contactName,
      telefono: api.telephone,
      email: api.email,
      relationship: api.relationship || 'Otro',
      photo: api.photo || null,
    };
  }

  // Transforma ContactoEmergencia del frontend al formato del backend
  private mapContactToApi(contacto: Omit<EmergencyContact, 'id'>): any {
    return {
      // No enviamos userProfileId, el backend lo establece automáticamente
      contactName: contacto.nombre,
      telephone: contacto.telefono,
      // El correo es el canal por el que el contacto recibe el aviso cuando se activa una alerta
      email: contacto.email?.trim() || null,
      relationship: contacto.relationship,
      photo: contacto.photo || undefined,
    };
  }

  getByUser(userId: number): Observable<EmergencyContact[]> {
    return this.http.get<EmergencyContactApi[]>(`${this.url}/user/${userId}`).pipe(
      map(contacts => contacts.map(c => this.mapApiToContact(c)))
    );
  }

  create(contacto: Omit<EmergencyContact, 'id'>): Observable<EmergencyContact> {
    const apiData = this.mapContactToApi(contacto);
    return this.http.post<EmergencyContactApi>(this.url, apiData).pipe(
      map(api => this.mapApiToContact(api))
    );
  }

  update(id: number, contacto: Partial<EmergencyContact>): Observable<EmergencyContact> {
    const apiData: any = {};
    if (contacto.nombre !== undefined) apiData.contactName = contacto.nombre;
    if (contacto.telefono !== undefined) apiData.telephone = contacto.telefono;
    if (contacto.relationship !== undefined) apiData.relationship = contacto.relationship;
    if (contacto.email !== undefined) apiData.email = contacto.email?.trim() || null;
    // "" quita la foto; sin el campo no se toca
    if (contacto.photo !== undefined) apiData.photo = contacto.photo ?? '';
    // El backend expone PUT (no PATCH) y solo cambia los campos enviados
    return this.http.put<EmergencyContactApi>(`${this.url}/${id}`, apiData).pipe(
      map(api => this.mapApiToContact(api))
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}