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

/** Alert as the panel user detail lists it. */
export interface AlertSummary {
  id: string;
  userId: number;
  description: string;
  location: string;
  status: string;
  createdAt: string;
}

/** What has been done with an account (blocks, unblocks, deletion requests). */
export interface ModerationHistory {
  date: string;
  type: string;
  adminName: string | null;
  reason: string | null;
  note: string | null;
  caseId: number | null;
  hasEvidence: boolean;
}

/** Moderation history as the backend sends it (JSON keys in Spanish). */
interface ModerationHistoryApi {
  fecha: string;
  tipo: string;
  adminNombre: string | null;
  motivo: string | null;
  nota: string | null;
  casoId: number | null;
  tieneEvidencia: boolean;
}

/** The user's phone as the panel sees it (GET /api/devices, admin only). */
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

  updateStatus(id: string | number, status: ManagedUser['status']): Observable<ManagedUser> {
    const accountStatus = this.mapStatusToApi(status);
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

  // Creates the user through the backend registration endpoint
  createUser(data: Record<string, any>): Observable<ManagedUser> {
    return this.http.post<any>(`${this.apiUrl}/api/auth/register`, {
      nombre: data['nombre'],
      email: data['email'],
      password: data['password'],
      telefono: data['telefono']
    }).pipe(
      map(response => {
        // Registration returns a different format, map it
        const user = response.user;
        return {
          id: user.id.toString(),
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          telephone: user.telephone || '',
          registeredAt: user.createdAt,
          alerts: 0,
          lastActivity: user.createdAt,
          status: 'Activa' as const,
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
      name: `${dto.firstName} ${dto.lastName}`,
      email: dto.email,
      telephone: dto.telephone || '',
      registeredAt: dto.createdAt,
      alerts: dto.alertCount,
      lastActivity: dto.lastAccess || dto.createdAt,
      status: this.mapStatusFromApi(dto.accountStatus),
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

    if (changes['status']) {
      apiChanges['accountStatus'] = this.mapStatusToApi(changes['status'] as ManagedUser['status']);
    }
    if (changes['name']) {
      // Split nombre into firstName and lastName
      const parts = (changes['name'] as string).split(' ');
      apiChanges['firstName'] = parts[0];
      apiChanges['lastName'] = parts.slice(1).join(' ') || parts[0];
    }
    if (changes['first_name']) {
      apiChanges['firstName'] = changes['first_name'];
    }
    if (changes['last_name']) {
      apiChanges['lastName'] = changes['last_name'];
    }
    if (changes['telephone']) {
      apiChanges['telephone'] = changes['telephone'];
    }
    if (changes['email']) {
      apiChanges['email'] = changes['email'];
    }

    return apiChanges;
  }

  /**
   * Map backend account status to frontend estado
   */
  private mapStatusFromApi(accountStatus: string | null): ManagedUser['status'] {
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
  private mapStatusToApi(status: ManagedUser['status']): string {
    switch (status) {
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

  // ── Moderation ───────────────────────────────────────────────
  block(id: string | number, reason: string, description: string, evidence: string | null): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/admin/users/${id}/block`, {
      reason: reason, description, evidence,
    });
  }

  unblock(id: string | number, note: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/admin/users/${id}/unblock`, { note: note });
  }

  history(id: string | number): Observable<ModerationHistory[]> {
    return this.http
      .get<ModerationHistoryApi[]>(`${this.apiUrl}/api/admin/users/${id}/moderation-history`)
      .pipe(
        map((list) =>
          list.map((h) => ({
            date: h.fecha,
            type: h.tipo,
            adminName: h.adminNombre,
            reason: h.motivo,
            note: h.nota,
            caseId: h.casoId,
            hasEvidence: h.tieneEvidencia,
          })),
        ),
      );
  }

  caseEvidenceOf(caseId: number): Observable<string | null> {
    return this.http.get<{ evidence: string } | null>(`${this.apiUrl}/api/admin/user-reports/${caseId}/evidence`)
      .pipe(map(r => r?.evidence ?? null));
  }

  requestDeletion(id: string | number, reason: string): Observable<DeletionRequest> {
    return this.http.post<DeletionRequest>(`${this.apiUrl}/api/admin/users/${id}/deletion-requests`, { reason: reason });
  }

  deletionRequests(): Observable<DeletionRequest[]> {
    return this.http.get<DeletionRequest[]>(`${this.apiUrl}/api/admin/deletion-requests`);
  }

  decideDeletion(id: number, approve: boolean, note: string): Observable<DeletionRequest> {
    return this.http.post<DeletionRequest>(
      `${this.apiUrl}/api/admin/deletion-requests/${id}/${approve ? 'approve' : 'reject'}`, { note: note });
  }

  /** Sends the user the email with the code to create a new password. */
  sendRecovery(email: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/auth/forgot-password`, { email });
  }

  phones(): Observable<AdminPhone[]> {
    return this.http.get<AdminPhone[]>(`${this.apiUrl}/api/devices`);
  }

  // ── Datos relacionados ───────────────────────────────────────
  /** Alerts of a user for the panel detail, mapped from the backend fields (message, latitude, startedAt...). */
  getAlertsByUser(userId: string | number): Observable<AlertSummary[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/alerts/user/${userId}`).pipe(
      map((list) =>
        list.map((a) => ({
          id: String(a.id),
          userId: a.userProfileId,
          description: a.message?.trim() || 'Alerta sin mensaje',
          location:
            a.latitude != null && a.longitude != null
              ? `${Number(a.latitude).toFixed(4)}, ${Number(a.longitude).toFixed(4)}`
              : 'Sin ubicación',
          status: a.status,
          createdAt: a.startedAt ?? a.createdAt ?? '',
        })),
      ),
    );
  }
}