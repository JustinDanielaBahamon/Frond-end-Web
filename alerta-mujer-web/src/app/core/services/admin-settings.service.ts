import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Parámetros globales de la app que edita la administración. */
export interface ParametrosApp {
  duracionMaximaAlertaMin: number;
  numeroEmergencia: string;
  correoSoporte: string;
  maxContactos: number;
  /** '' = no se exige versión mínima de la app móvil */
  versionMinimaApp: string;
  actualizado: Date | null;
}

export interface EstadoSistema {
  baseDatos: boolean;
  latenciaMs: number;
  notificacionesPush: boolean;
  alertasActivas: number;
  ultimaRevisionExpiracion: Date | null;
  expiradasUltimaRevision: number;
  enLineaDesde: Date;
}


export interface DatosContacto {
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

  obtenerParametros(): Observable<ParametrosApp> {
    return this.http.get<SettingsApi>(`${this.api}/api/admin/settings`).pipe(map(s => this.desdeApi(s)));
  }

  guardarParametros(p: Omit<ParametrosApp, 'actualizado'>): Observable<ParametrosApp> {
    return this.http.put<SettingsApi>(`${this.api}/api/admin/settings`, {
      sosMaxDurationMinutes: p.duracionMaximaAlertaMin,
      emergencyPhoneNumber: p.numeroEmergencia,
      supportEmail: p.correoSoporte,
      maxEmergencyContacts: p.maxContactos,
      minAppVersion: p.versionMinimaApp
    }).pipe(map(s => this.desdeApi(s)));
  }

  obtenerMisDatos(): Observable<DatosContacto> {
    return this.http.get<DatosContacto>(`${this.api}/api/users/me`).pipe(
      map(u => ({ firstName: u.firstName ?? '', lastName: u.lastName ?? '', telephone: u.telephone ?? '' }))
    );
  }

  obtenerEstado(): Observable<EstadoSistema> {
    return this.http.get<any>(`${this.api}/api/admin/system-status`).pipe(map(s => ({
      baseDatos: s.database,
      latenciaMs: s.databaseLatencyMs,
      notificacionesPush: s.pushNotifications,
      alertasActivas: s.activeAlerts,
      ultimaRevisionExpiracion: s.lastExpirationCheck ? new Date(s.lastExpirationCheck) : null,
      expiradasUltimaRevision: s.lastExpiredCount,
      enLineaDesde: new Date(s.startedAt)
    })));
  }


  /** Datos de la cuenta en sesión (nombre y teléfono). */
  actualizarMisDatos(datos: DatosContacto): Observable<DatosContacto> {
    return this.http.put<DatosContacto>(`${this.api}/api/users/me`, datos);
  }

  cambiarContrasena(actual: string, nueva: string): Observable<void> {
    return this.http.put<void>(`${this.api}/api/users/me/password`, {
      currentPassword: actual,
      newPassword: nueva
    });
  }

  private desdeApi(s: SettingsApi): ParametrosApp {
    return {
      duracionMaximaAlertaMin: s.sosMaxDurationMinutes,
      numeroEmergencia: s.emergencyPhoneNumber,
      correoSoporte: s.supportEmail,
      maxContactos: s.maxEmergencyContacts,
      versionMinimaApp: s.minAppVersion ?? '',
      actualizado: s.updatedAt ? new Date(s.updatedAt) : null
    };
  }
}
