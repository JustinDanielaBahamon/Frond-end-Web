import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FrequentPlace } from '../models/frequent-place.model';

// ADJUST this import path if your other services (phone.location.services.ts)
// import "environment" differently, or if it doesn't expose "apiUrl".

@Injectable({ providedIn: 'root' })
export class FrequentPlaceService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/frequentPlaces`;

  getByUser(userId: number): Observable<FrequentPlace[]> {
    return this.http.get<FrequentPlace[]>(`${this.baseUrl}?userId=${userId}`);
  }

  create(place: Omit<FrequentPlace, 'id'>): Observable<FrequentPlace> {
    return this.http.post<FrequentPlace>(this.baseUrl, place);
  }

  update(id: number, place: Partial<FrequentPlace>): Observable<FrequentPlace> {
    return this.http.patch<FrequentPlace>(`${this.baseUrl}/${id}`, place);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}