import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FrequentPlace } from '../models/frequent-place.model';

/** Shape in which the backend (/api/frequent-locations) sends and receives a frequent place. */
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

  /** userId = id of the authenticated user (users.id). */
  getByUser(userId: number): Observable<FrequentPlace[]> {
    return this.http
      .get<FrequentLocationApi[]>(`${this.baseUrl}/user/${userId}`)
      .pipe(map((list) => list.map((api) => this.fromApi(api))));
  }

  create(place: Omit<FrequentPlace, 'id'>): Observable<FrequentPlace> {
    // We do not send userId/userProfileId: the backend takes the owner from the token
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

  // The backend does not store type or isMain; they are returned with default values.
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

  /** Only includes the present fields, so PATCH does not overwrite the rest. */
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
