import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

import { Usuario } from '../models/user.model';

// Backend DTO interface
interface AdminUserDto {
  id: number;
  userProfileId: number | null;
  firstName: string;
  lastName: string;
  email: string;
  telephone: string | null;
  role: string | null;
  accountStatus: string | null;
  createdAt: string;
  lastAccess: string | null;
  alertCount: number;
}

/** Lo que se ha hecho con una cuenta (bloqueos, desbloqueos, solicitudes de eliminación). */
export interface HistorialModeracion {
  fecha: string;
  tipo: string;
  adminNombre: string | null;
  motivo: string | null;
  nota: string | null;
  casoId: number | null;
  tieneEvidencia: boolean;
}

/** Celular de la usuaria tal como lo ve el panel (GET /api/devices, solo admin). */
export interface CelularAdmin {
  id: number;
  userId: number | null;
  brand: string | null;
  model: string | null;
  deviceName: string | null;
  osName: string;
  osVersion: string | null;
  appVersion: string | null;
  gpsStatus: string;
  lastAccess: string | null;
  pushTokenRegistered: boolean;
  permissions: string | null;
  permissionsUpdatedAt: string | null;
}

export interface SolicitudEliminacion {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  requestedBy: number;
  requestedByName: string | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  decidedByName: string | null;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class UsersService {

  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // ── Usuarias ─────────────────────────────────────────────────
  getAll(): Observable<Usuario[]> {
    return this.http.get<AdminUserDto[]>(`${this.apiUrl}/api/admin/users`).pipe(
      map(dtos => dtos.map(dto => this.fromApi(dto)))
    );
  }

  updateEstado(id: string | number, estado: Usuario['estado']): Observable<Usuario> {
    const accountStatus = this.mapEstadoToApi(estado);
    return this.http.patch<AdminUserDto>(`${this.apiUrl}/api/admin/users/${id}`, { accountStatus }).pipe(
      map(dto => this.fromApi(dto))
    );
  }

  actualizarUsuaria(id: string | number, cambios: Partial<Usuario> & Record<string, unknown>): Observable<Usuario> {
    const apiChanges = this.toApi(cambios);
    return this.http.patch<AdminUserDto>(`${this.apiUrl}/api/admin/users/${id}`, apiChanges).pipe(
      map(dto => this.fromApi(dto))
    );
  }

  // Crea la usuaria usando el endpoint de registro del backend
  crearUsuaria(data: Record<string, any>): Observable<Usuario> {
    return this.http.post<any>(`${this.apiUrl}/api/auth/register`, {
      nombre: data['nombre'],
      email: data['email'],
      password: data['password'],
      telefono: data['telefono']
    }).pipe(
      map(response => {
        // El registro devuelve un formato diferente, mapearlo
        const user = response.user;
        return {
          id: user.id.toString(),
          nombre: `${user.firstName} ${user.lastName}`,
          email: user.email,
          telefono: user.telephone || '',
          fechaRegistro: user.createdAt,
          alertas: 0,
          ultimaActividad: user.createdAt,
          estado: 'Activa' as const,
          rol: user.roleName || 'USER',
          avatarColor: this.generateAvatarColor(),
          first_name: user.firstName,
          last_name: user.lastName
        };
      })
    );
  }

  // ── Mapeo de datos ───────────────────────────────────────────
  /**
   * Convert backend AdminUserDto to frontend Usuario model
   */
  private fromApi(dto: AdminUserDto): Usuario {
    return {
      id: dto.id.toString(),
      nombre: `${dto.firstName} ${dto.lastName}`,
      email: dto.email,
      telefono: dto.telephone || '',
      fechaRegistro: dto.createdAt,
      alertas: dto.alertCount,
      ultimaActividad: dto.lastAccess || dto.createdAt,
      estado: this.mapEstadoFromApi(dto.accountStatus),
      rol: dto.role || 'user',
      avatarColor: this.generateAvatarColor(),
      first_name: dto.firstName,
      last_name: dto.lastName
    };
  }

  /**
   * Convert frontend changes to backend format
   */
  private toApi(cambios: Partial<Usuario> & Record<string, unknown>): Record<string, unknown> {
    const apiChanges: Record<string, unknown> = {};

    if (cambios['estado']) {
      apiChanges['accountStatus'] = this.mapEstadoToApi(cambios['estado'] as Usuario['estado']);
    }
    if (cambios['nombre']) {
      // Split nombre into firstName and lastName
      const parts = (cambios['nombre'] as string).split(' ');
      apiChanges['firstName'] = parts[0];
      apiChanges['lastName'] = parts.slice(1).join(' ') || parts[0];
    }
    if (cambios['first_name']) {
      apiChanges['firstName'] = cambios['first_name'];
    }
    if (cambios['last_name']) {
      apiChanges['lastName'] = cambios['last_name'];
    }
    if (cambios['telefono']) {
      apiChanges['telephone'] = cambios['telefono'];
    }
    if (cambios['email']) {
      apiChanges['email'] = cambios['email'];
    }

    return apiChanges;
  }

  /**
   * Map backend account status to frontend estado
   */
  private mapEstadoFromApi(accountStatus: string | null): Usuario['estado'] {
    switch (accountStatus) {
      case 'active':
        return 'Activa';
      case 'inactive':
        return 'Inactiva';
      case 'blocked':
        return 'Bloqueada por Fraude';
      default:
        return 'Inactiva';
    }
  }

  /**
   * Map frontend estado to backend account status
   */
  private mapEstadoToApi(estado: Usuario['estado']): string {
    switch (estado) {
      case 'Activa':
        return 'active';
      case 'Inactiva':
        return 'inactive';
      case 'Bloqueada por Fraude':
        return 'blocked';
      default:
        return 'inactive';
    }
  }

  /**
   * Generate a random avatar color
   */
  private generateAvatarColor(): string {
    const colors = ['#7B1DB2', '#9333EA', '#A855F7', '#C026D3', '#D946EF', '#6D28D9', '#BB8FCE', '#8B5CF6'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // ── Moderación ───────────────────────────────────────────────
  bloquear(id: string | number, motivo: string, descripcion: string, evidencia: string | null): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/admin/users/${id}/block`, {
      reason: motivo, description: descripcion, evidence: evidencia,
    });
  }

  desbloquear(id: string | number, nota: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/admin/users/${id}/unblock`, { note: nota });
  }

  historial(id: string | number): Observable<HistorialModeracion[]> {
    return this.http.get<HistorialModeracion[]>(`${this.apiUrl}/api/admin/users/${id}/moderation-history`);
  }

  evidenciaDeCaso(casoId: number): Observable<string | null> {
    return this.http.get<{ evidence: string } | null>(`${this.apiUrl}/api/admin/user-reports/${casoId}/evidence`)
      .pipe(map(r => r?.evidence ?? null));
  }

  solicitarEliminacion(id: string | number, motivo: string): Observable<SolicitudEliminacion> {
    return this.http.post<SolicitudEliminacion>(`${this.apiUrl}/api/admin/users/${id}/deletion-requests`, { reason: motivo });
  }

  solicitudesEliminacion(): Observable<SolicitudEliminacion[]> {
    return this.http.get<SolicitudEliminacion[]>(`${this.apiUrl}/api/admin/deletion-requests`);
  }

  decidirEliminacion(id: number, aprobar: boolean, nota: string): Observable<SolicitudEliminacion> {
    return this.http.post<SolicitudEliminacion>(
      `${this.apiUrl}/api/admin/deletion-requests/${id}/${aprobar ? 'approve' : 'reject'}`, { note: nota });
  }

  /** Envía a la usuaria el correo con el código para crear una contraseña nueva. */
  enviarRecuperacion(email: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/auth/forgot-password`, { email });
  }

  celulares(): Observable<CelularAdmin[]> {
    return this.http.get<CelularAdmin[]>(`${this.apiUrl}/api/devices`);
  }

  // ── Datos relacionados ───────────────────────────────────────
  getAlertasByUsuaria(usuarioId: string | number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/alerts/user/${usuarioId}`);
  }

  // user_profile_id coincide con el id de la usuaria
  getContactos(usuarioId: string | number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/contacts/user/${usuarioId}`);
  }
}