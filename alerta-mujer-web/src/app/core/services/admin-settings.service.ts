import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Parámetros globales de la app que edita la administración. */
export interface AppSettings {
  maxAlertDurationMin: number;
  emergencyNumber: string;
  supportEmail: string;
  maxContacts: number;
  /** '' = no se exige versión mínima de la app móvil */
  versionMinimaApp: string;
  updated: Date | null;
}

export interface SystemStatus {
  database: boolean;
  latencyMs: number;
  pushNotifications: boolean;
  activeAlerts: number;
  lastExpirationRun: Date | null;
  expiredLastRun: number;
  onlineSince: Date;
}


export interface ContactData {
  firstName: string;
  lastName: string;
  telephone: string;
}

interface SettingsApi {
  sosMaxDurationMinutes: number;
  emergencyPhoneNumber: string;
  supportEmail: string;
  maxEmergencyContacts: number;
  minAppVersion: string | null;
  updatedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminSettingsService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  getSettings(): Observable<AppSettings> {
    return this.http.get<SettingsApi>(`${this.api}/api/admin/settings`).pipe(map(s => this.fromApi(s)));
  }

  saveSettings(p: Omit<AppSettings, 'updated'>): Observable<AppSettings> {
    return this.http.put<SettingsApi>(`${this.api}/api/admin/settings`, {
      sosMaxDurationMinutes: p.maxAlertDurationMin,
      emergencyPhoneNumber: p.emergencyNumber,
      supportEmail: p.supportEmail,
      maxEmergencyContacts: p.maxContacts,
      minAppVersion: p.versionMinimaApp
    }).pipe(map(s => this.fromApi(s)));
  }

  getMyData(): Observable<ContactData> {
    return this.http.get<ContactData>(`${this.api}/api/users/me`).pipe(
      map(u => ({ firstName: u.firstName ?? '', lastName: u.lastName ?? '', telephone: u.telephone ?? '' }))
    );
  }

  getStatus(): Observable<SystemStatus> {
    return this.http.get<any>(`${this.api}/api/admin/system-status`).pipe(map(s => ({
      database: s.database,
      latencyMs: s.databaseLatencyMs,
      pushNotifications: s.pushNotifications,
      activeAlerts: s.activeAlerts,
      lastExpirationRun: s.lastExpirationCheck ? new Date(s.lastExpirationCheck) : null,
      expiredLastRun: s.lastExpiredCount,
      onlineSince: new Date(s.startedAt)
    })));
  }


  /** Datos de la cuenta en sesión (nombre y teléfono). */
  updateMyData(data: ContactData): Observable<ContactData> {
    return this.http.put<ContactData>(`${this.api}/api/users/me`, data);
  }

  changePassword(current: string, newOne: string): Observable<void> {
    return this.http.put<void>(`${this.api}/api/users/me/password`, {
      currentPassword: current,
      newPassword: newOne
    });
  }

  private fromApi(s: SettingsApi): AppSettings {
    return {
      maxAlertDurationMin: s.sosMaxDurationMinutes,
      emergencyNumber: s.emergencyPhoneNumber,
      supportEmail: s.supportEmail,
      maxContacts: s.maxEmergencyContacts,
      versionMinimaApp: s.minAppVersion ?? '',
      updated: s.updatedAt ? new Date(s.updatedAt) : null
    };
  }
}
