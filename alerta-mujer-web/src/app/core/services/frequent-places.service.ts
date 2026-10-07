import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { FrequentPlace } from '../models/frequent-place.model';

@Injectable({ providedIn: 'root' })
export class FrequentPlaceService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/frequent-locations`;

  getByUser(userId: number): Observable<FrequentPlace[]> {
    return this.http
      .get<any[]>(`${this.baseUrl}/user/${userId}`)
      .pipe(map((lista) => lista.map((item) => this.normalizar(item))));
  }

  create(
    place: Omit<FrequentPlace, 'id' | 'type'>,
  ): Observable<FrequentPlace> {
    return this.http
      .post<any>(this.baseUrl, {
        userProfileId: place.userId,
        name: place.name,
        address: place.address,
        city: place.city,
        latitude: place.lat,
        longitude: place.lng,
        notes: place.notes ?? '',
      })
      .pipe(map((creado) => this.normalizar(creado)));
  }

  /**
   * El backend hace replace (no merge): si no se manda address/city/notes
   * los borra. Por eso siempre se envía el lugar completo.
   */
  update(
    id: number,
    place: Omit<FrequentPlace, 'id' | 'type'>,
  ): Observable<FrequentPlace> {
    return this.http
      .put<any>(`${this.baseUrl}/${id}`, {
        userProfileId: place.userId,
        name: place.name,
        address: place.address,
        city: place.city,
        latitude: place.lat,
        longitude: place.lng,
        notes: place.notes ?? '',
      })
      .pipe(map((actualizado) => this.normalizar(actualizado)));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** Adapta la entidad del backend (userProfileId, latitude, longitude)
   *  al modelo de la web. El backend no tiene "type" ni "isMain". */
  private normalizar(f: any): FrequentPlace {
    return {
      id: Number(f.id ?? 0),
      userId: Number(f.userProfileId ?? f.userId ?? 0),
      name: f.name ?? 'Sin nombre',
      type: 'other',
      address: f.address ?? '',
      city: f.city ?? '',
      lat: Number(f.latitude ?? f.lat ?? 0),
      lng: Number(f.longitude ?? f.lng ?? 0),
      notes: f.notes,
      riskLevel: f.riskLevel,
    };
  }
}
