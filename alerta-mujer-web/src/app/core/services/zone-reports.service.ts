import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ZoneReport } from '../models/zone-report.model';

@Injectable({ providedIn: 'root' })
export class ZoneReportsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/zone-reports`;

  /**
   * Obtener todos los reportes de zonas (solo admin)
   */
  getAllReports(): Observable<ZoneReport[]> {
    return this.http.get<ZoneReport[]>(this.apiUrl);
  }

  /**
   * Obtener reporte por ID
   */
  getReportById(id: number): Observable<ZoneReport> {
    return this.http.get<ZoneReport>(`${this.apiUrl}/${id}`);
  }

  /**
   * Obtener reportes por zona
   */
  getReportsByZone(zoneId: number): Observable<ZoneReport[]> {
    return this.http.get<ZoneReport[]>(`${this.apiUrl}/zone/${zoneId}`);
  }

  /**
   * Obtener reportes por usuario perfil
   */
  getReportsByUserProfile(userProfileId: number): Observable<ZoneReport[]> {
    return this.http.get<ZoneReport[]>(`${this.apiUrl}/my/${userProfileId}`);
  }

  /**
   * Obtener reportes por estado
   */
  getReportsByStatus(status: string): Observable<ZoneReport[]> {
    return this.http.get<ZoneReport[]>(`${this.apiUrl}/status/${status}`);
  }

  /**
   * Crear nuevo reporte de zona
   */
  createReport(report: Omit<ZoneReport, 'id'>, currentUserId?: number): Observable<ZoneReport> {
    const body = {
      ...report,
      userProfileId: currentUserId
    };
    return this.http.post<ZoneReport>(this.apiUrl, body);
  }

  /**
   * Actualizar reporte existente
   */
  updateReport(id: number, report: ZoneReport): Observable<ZoneReport> {
    return this.http.put<ZoneReport>(`${this.apiUrl}/${id}`, report);
  }

  /**
   * Aprobar reporte (solo admin)
   */
  approveReport(id: number, adminId: number): Observable<ZoneReport> {
    return this.http.put<ZoneReport>(`${this.apiUrl}/${id}/approve`, { adminId });
  }

  /**
   * Rechazar reporte (solo admin)
   */
  rejectReport(id: number, adminId: number): Observable<ZoneReport> {
    return this.http.put<ZoneReport>(`${this.apiUrl}/${id}/reject`, { adminId });
  }

  /**
   * Eliminar reporte
   */
  deleteReport(id: number, currentUserId?: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}