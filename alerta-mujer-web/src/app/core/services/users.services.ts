import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

import { ManagedUser } from '../models/user.model';

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
export interface ModerationHistory {
  fecha: string;
  tipo: string;
  adminNombre: string | null;
  motivo: string | null;
  nota: string | null;
  casoId: number | null;
  tieneEvidencia: boolean;
}

/** Celular de la usuaria tal como lo ve el panel (GET /api/devices, solo admin). */
export interface AdminPhone {
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

export interface DeletionRequest {
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
  getAll(): Observable<ManagedUser[]> {
    return this.http.get<AdminUserDto[]>(`${this.apiUrl}/api/admin/users`).pipe(
      map(dtos => dtos.map(dto => this.fromApi(dto)))
    );
  }

  updateStatus(id: string | number, estado: ManagedUser['estado']): Observable<ManagedUser> {
    const accountStatus = this.mapStatusToApi(estado);
    return this.http.patch<AdminUserDto>(`${this.apiUrl}/api/admin/users/${id}`, { accountStatus }).pipe(
      map(dto => this.fromApi(dto))
    );
  }

  updateUser(id: string | number, changes: Partial<ManagedUser> & Record<string, unknown>): Observable<ManagedUser> {
    const apiChanges = this.toApi(changes);
    return this.http.patch<AdminUserDto>(`${this.apiUrl}/api/admin/users/${id}`, apiChanges).pipe(
      map(dto => this.fromApi(dto))
    );
  }

  // Crea la usuaria usando el endpoint de registro del backend
  createUser(data: Record<string, any>): Observable<ManagedUser> {
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
          registeredAt: user.createdAt,
          alerts: 0,
          lastActivity: user.createdAt,
          estado: 'Activa' as const,
          role: user.roleName || 'USER',
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
  private fromApi(dto: AdminUserDto): ManagedUser {
    return {
      id: dto.id.toString(),
      nombre: `${dto.firstName} ${dto.lastName}`,
      email: dto.email,
      telefono: dto.telephone || '',
      registeredAt: dto.createdAt,
      alerts: dto.alertCount,
      lastActivity: dto.lastAccess || dto.createdAt,
      estado: this.mapStatusFromApi(dto.accountStatus),
      role: dto.role || 'user',
      avatarColor: this.generateAvatarColor(),
      first_name: dto.firstName,
      last_name: dto.lastName
    };
  }

  /**
   * Convert frontend changes to backend format
   */
  private toApi(changes: Partial<ManagedUser> & Record<string, unknown>): Record<string, unknown> {
    const apiChanges: Record<string, unknown> = {};

    if (changes['estado']) {
      apiChanges['accountStatus'] = this.mapStatusToApi(changes['estado'] as ManagedUser['estado']);
    }
    if (changes['nombre']) {
      // Split nombre into firstName and lastName
      const parts = (changes['nombre'] as string).split(' ');
      apiChanges['firstName'] = parts[0];
      apiChanges['lastName'] = parts.slice(1).join(' ') || parts[0];
    }
    if (changes['first_name']) {
      apiChanges['firstName'] = changes['first_name'];
    }
    if (changes['last_name']) {
      apiChanges['lastName'] = changes['last_name'];
    }
    if (changes['telefono']) {
      apiChanges['telephone'] = changes['telefono'];
    }
    if (changes['email']) {
      apiChanges['email'] = changes['email'];
    }

    return apiChanges;
  }

  /**
   * Map backend account status to frontend estado
   */
  private mapStatusFromApi(accountStatus: string | null): ManagedUser['estado'] {
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
  private mapStatusToApi(estado: ManagedUser['estado']): string {
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
  block(id: string | number, motivo: string, description: string, evidence: string | null): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/admin/users/${id}/block`, {
      reason: motivo, description, evidence,
    });
  }

  unblock(id: string | number, nota: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/admin/users/${id}/unblock`, { note: nota });
  }

  history(id: string | number): Observable<ModerationHistory[]> {
    return this.http.get<ModerationHistory[]>(`${this.apiUrl}/api/admin/users/${id}/moderation-history`);
  }

  caseEvidenceOf(casoId: number): Observable<string | null> {
    return this.http.get<{ evidence: string } | null>(`${this.apiUrl}/api/admin/user-reports/${casoId}/evidence`)
      .pipe(map(r => r?.evidence ?? null));
  }

  requestDeletion(id: string | number, motivo: string): Observable<DeletionRequest> {
    return this.http.post<DeletionRequest>(`${this.apiUrl}/api/admin/users/${id}/deletion-requests`, { reason: motivo });
  }

  deletionRequests(): Observable<DeletionRequest[]> {
    return this.http.get<DeletionRequest[]>(`${this.apiUrl}/api/admin/deletion-requests`);
  }

  decideDeletion(id: number, approve: boolean, nota: string): Observable<DeletionRequest> {
    return this.http.post<DeletionRequest>(
      `${this.apiUrl}/api/admin/deletion-requests/${id}/${approve ? 'approve' : 'reject'}`, { note: nota });
  }

  /** Envía a la usuaria el correo con el código para crear una contraseña nueva. */
  sendRecovery(email: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/auth/forgot-password`, { email });
  }

  celulares(): Observable<AdminPhone[]> {
    return this.http.get<AdminPhone[]>(`${this.apiUrl}/api/devices`);
  }

  // ── Datos relacionados ───────────────────────────────────────
  getAlertsByUser(userId: string | number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/alerts/user/${userId}`);
  }
}