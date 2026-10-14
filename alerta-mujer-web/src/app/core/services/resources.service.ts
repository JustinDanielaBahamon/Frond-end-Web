import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EmergencyResource, EmergencyResourceApi, ResourceCall } from '../models/resource.model';

@Injectable({ providedIn: 'root' })
export class ResourcesService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/resources`;

  /**
   * Obtener todos los recursos de emergencia
   */
  getAllResources(): Observable<EmergencyResource[]> {
    return this.http.get<EmergencyResource[]>(this.apiUrl);
  }

  /** Recursos activos con los campos reales del backend (teléfonos y coordenadas). */
  getActiveResources(): Observable<EmergencyResourceApi[]> {
    return this.http
      .get<EmergencyResourceApi[]>(this.apiUrl)
      .pipe(map((lista) => lista.filter((r) => r.isActive !== false)));
  }

  /**
   * Obtener recurso por ID
   */
  getResourceById(id: number): Observable<EmergencyResource> {
    return this.http.get<EmergencyResource>(`${this.apiUrl}/${id}`);
  }

  /**
   * Filtrar recursos por ciudad
   */
  getResourcesByCity(city: string): Observable<EmergencyResource[]> {
    return this.http.get<EmergencyResource[]>(`${this.apiUrl}/city/${city}`);
  }

  /**
   * Filtrar recursos por tipo
   */
  getResourcesByType(type: string): Observable<EmergencyResource[]> {
    return this.http.get<EmergencyResource[]>(`${this.apiUrl}/type/${type}`);
  }

  /**
   * Crear nuevo recurso de emergencia
   */
  createResource(resource: Omit<EmergencyResource, 'id'>): Observable<EmergencyResource> {
    return this.http.post<EmergencyResource>(this.apiUrl, resource);
  }

  /**
   * Actualizar recurso existente
   */
  updateResource(id: number, resource: EmergencyResource): Observable<EmergencyResource> {
    return this.http.put<EmergencyResource>(`${this.apiUrl}/${id}`, resource);
  }

  /**
   * Eliminar recurso
   */
  deleteResource(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}