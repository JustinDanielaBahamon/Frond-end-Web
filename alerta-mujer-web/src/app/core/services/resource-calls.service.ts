import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ResourceCall } from '../models/resource.model';

@Injectable({ providedIn: 'root' })
export class ResourceCallsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/resource-calls`;

  /**
   * Obtener todas las llamadas a recursos (solo admin)
   */
  getAllCalls(): Observable<ResourceCall[]> {
    return this.http.get<ResourceCall[]>(this.apiUrl);
  }

  /**
   * Obtener llamadas por usuario perfil
   */
  getCallsByUser(userProfileId: number): Observable<ResourceCall[]> {
    return this.http.get<ResourceCall[]>(`${this.apiUrl}/user/${userProfileId}`);
  }

  /**
   * Obtener llamadas del usuario actual
   */
  getMyCalls(currentUserId?: number): Observable<ResourceCall[]> {
    if (currentUserId) {
      return this.http.get<ResourceCall[]>(`${this.apiUrl}/me`);
    }
    return this.http.get<ResourceCall[]>(`${this.apiUrl}/me`);
  }

  /**
   * Obtener llamadas por recurso de emergencia
   */
  getCallsByResource(emergencyResourceId: number): Observable<ResourceCall[]> {
    return this.http.get<ResourceCall[]>(`${this.apiUrl}/resource/${emergencyResourceId}`);
  }

  /**
   * Obtener llamadas por alerta
   */
  getCallsByAlert(alertId: number): Observable<ResourceCall[]> {
    return this.http.get<ResourceCall[]>(`${this.apiUrl}/alert/${alertId}`);
  }

  /**
   * Crear nueva llamada a recurso
   */
  createCall(call: Omit<ResourceCall, 'id'>, currentUserId?: number): Observable<ResourceCall> {
    const body = {
      ...call,
      userProfileId: currentUserId
    };
    return this.http.post<ResourceCall>(this.apiUrl, body);
  }

  /**
   * Actualizar llamada existente
   */
  updateCall(id: number, call: ResourceCall, currentUserId?: number): Observable<ResourceCall> {
    const body = {
      ...call,
      userProfileId: currentUserId
    };
    return this.http.put<ResourceCall>(`${this.apiUrl}/${id}`, body);
  }

  /**
   * Eliminar llamada
   */
  deleteCall(id: number, currentUserId?: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}