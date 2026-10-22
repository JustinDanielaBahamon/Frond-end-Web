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
      name: api.contactName,
      telephone: api.telephone,
      email: api.email,
      relationship: api.relationship || 'Otro',
      photo: api.photo || null,
    };
  }

  // Transforma ContactoEmergencia del frontend al formato del backend
  private mapContactToApi(contact: Omit<EmergencyContact, 'id'>): any {
    return {
      // No enviamos userProfileId, el backend lo establece automáticamente
      contactName: contact.name,
      telephone: contact.telephone,
      // El correo es el canal por el que el contacto recibe el aviso cuando se activa una alerta
      email: contact.email?.trim() || null,
      relationship: contact.relationship,
      photo: contact.photo || undefined,
    };
  }

  getByUser(userId: number): Observable<EmergencyContact[]> {
    return this.http.get<EmergencyContactApi[]>(`${this.url}/user/${userId}`).pipe(
      map(contacts => contacts.map(c => this.mapApiToContact(c)))
    );
  }

  create(contact: Omit<EmergencyContact, 'id'>): Observable<EmergencyContact> {
    const apiData = this.mapContactToApi(contact);
    return this.http.post<EmergencyContactApi>(this.url, apiData).pipe(
      map(api => this.mapApiToContact(api))
    );
  }

  update(id: number, contact: Partial<EmergencyContact>): Observable<EmergencyContact> {
    const apiData: any = {};
    if (contact.name !== undefined) apiData.contactName = contact.name;
    if (contact.telephone !== undefined) apiData.telephone = contact.telephone;
    if (contact.relationship !== undefined) apiData.relationship = contact.relationship;
    if (contact.email !== undefined) apiData.email = contact.email?.trim() || null;
    // "" quita la foto; sin el campo no se toca
    if (contact.photo !== undefined) apiData.photo = contact.photo ?? '';
    // El backend expone PUT (no PATCH) y solo cambia los campos enviados
    return this.http.put<EmergencyContactApi>(`${this.url}/${id}`, apiData).pipe(
      map(api => this.mapApiToContact(api))
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}