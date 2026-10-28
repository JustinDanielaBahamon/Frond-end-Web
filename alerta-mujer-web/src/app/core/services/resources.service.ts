import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EmergencyResource, EmergencyResourceApi, ResourceCall } from '../models/resource.model';
import { MapPoint, PointType, POINT_TYPES } from '../models/map-zone.model';

@Injectable({ providedIn: 'root' })
export class ResourcesService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/resources`;

  /** Support points of the alerts map (CAI, hospitals, firefighters...): resources with coordinates. */
  getMapPoints(): Observable<MapPoint[]> {
    return this.http.get<EmergencyResourceApi[]>(this.apiUrl).pipe(
      map(resources => resources
        .filter(r => r.resourceType in POINT_TYPES && r.latitude != null && r.longitude != null)
        .map(r => ({
          id: r.id,
          type: r.resourceType as PointType,
          name: r.name,
          lat: Number(r.latitude),
          lng: Number(r.longitude),
        })))
    );
  }

  createMapPoint(point: Omit<MapPoint, 'id'>): Observable<MapPoint> {
    const resource = {
      name: point.name,
      resourceType: point.type,
      city: 'Sin especificar',
      latitude: point.lat,
      longitude: point.lng,
    };
    return this.http.post<EmergencyResourceApi>(this.apiUrl, resource).pipe(
      map(r => ({ id: r.id, type: point.type, name: r.name, lat: Number(r.latitude), lng: Number(r.longitude) }))
    );
  }

  /**
   * Get all emergency resources
   */
  getAllResources(): Observable<EmergencyResource[]> {
    return this.http.get<EmergencyResource[]>(this.apiUrl);
  }

  /** Active resources with the real backend fields (phones and coordinates). */
  getActiveResources(): Observable<EmergencyResourceApi[]> {
    return this.http
      .get<EmergencyResourceApi[]>(this.apiUrl)
      .pipe(map((list) => list.filter((r) => r.isActive !== false)));
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