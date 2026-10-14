import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FrequentPlace } from '../models/frequent-place.model';

/** Forma en que el backend (/api/frequent-locations) envía y recibe un lugar frecuente. */
interface FrequentLocationApi {
  id: number;
  userProfileId: number;
  name: string;
  address?: string;
  city?: string;
  latitude: number;
  longitude: number;
  notes?: string;
  riskLevel?: FrequentPlace['riskLevel'];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class FrequentPlaceService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/frequent-locations`;

  /** userId = id de la usuaria autenticada (users.id). */
  getByUser(userId: number): Observable<FrequentPlace[]> {
    return this.http
      .get<FrequentLocationApi[]>(`${this.baseUrl}/user/${userId}`)
      .pipe(map((list) => list.map((api) => this.fromApi(api))));
  }

  create(place: Omit<FrequentPlace, 'id'>): Observable<FrequentPlace> {
    // No enviamos userId/userProfileId: el backend toma la dueña del token
    return this.http
      .post<FrequentLocationApi>(this.baseUrl, this.toApi(place))
      .pipe(map((api) => this.fromApi(api)));
  }

  update(id: number, place: Partial<FrequentPlace>): Observable<FrequentPlace> {
    return this.http
      .patch<FrequentLocationApi>(`${this.baseUrl}/${id}`, this.toApi(place))
      .pipe(map((api) => this.fromApi(api)));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // El backend no guarda type ni isMain; se devuelven con valores por defecto.
  private fromApi(api: FrequentLocationApi): FrequentPlace {
    return {
      id: api.id,
      userId: api.userProfileId,
      name: api.name,
      type: 'other',
      address: api.address ?? '',
      city: api.city ?? '',
      lat: Number(api.latitude),
      lng: Number(api.longitude),
      notes: api.notes,
      riskLevel: api.riskLevel,
      isActive: api.isActive,
      createdAt: api.createdAt,
      updatedAt: api.updatedAt,
    };
  }

  /** Solo incluye los campos presentes, para que PATCH no sobrescriba lo demás. */
  private toApi(place: Partial<FrequentPlace>): Partial<FrequentLocationApi> {
    const body: Partial<FrequentLocationApi> = {
      name: place.name,
      address: place.address,
      city: place.city,
      latitude: place.lat,
      longitude: place.lng,
      notes: place.notes,
      riskLevel: place.riskLevel,
      isActive: place.isActive,
    };
    return Object.fromEntries(
      Object.entries(body).filter(([, v]) => v !== undefined)
    ) as Partial<FrequentLocationApi>;
  }
}
