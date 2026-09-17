import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NearbyZone } from '../models/nearby-zone.model';

@Injectable({ providedIn: 'root' })
export class NearbyZoneService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/nearbyZones`;

  // If zones aren't user-specific in your backend, userId is simply unused here.
  getByUser(userId: number): Observable<NearbyZone[]> {
    return this.http.get<NearbyZone[]>(this.baseUrl);
  }
}