import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ContactoEmergencia } from '../models/emergency-contact.model';

@Injectable({ providedIn: 'root' })
export class EmergencyContactService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/contactos`;

  getByUsuario(usuarioId: number): Observable<ContactoEmergencia[]> {
    return this.http.get<ContactoEmergencia[]>(`${this.url}?usuarioId=${usuarioId}`);
  }

  create(contacto: Omit<ContactoEmergencia, 'id'>): Observable<ContactoEmergencia> {
    return this.http.post<ContactoEmergencia>(this.url, contacto);
  }

  update(id: number, contacto: Partial<ContactoEmergencia>): Observable<ContactoEmergencia> {
    return this.http.patch<ContactoEmergencia>(`${this.url}/${id}`, contacto);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}