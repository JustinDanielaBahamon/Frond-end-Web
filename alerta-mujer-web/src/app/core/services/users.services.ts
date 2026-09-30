import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

import { Usuario } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UsersService {

  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // ── Usuarias ─────────────────────────────────────────────────
  getAll(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.apiUrl}/api/admin/users`);
  }

  updateEstado(id: string | number, estado: Usuario['estado']): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.apiUrl}/api/admin/users/${id}`, { estado });
  }

  actualizarUsuaria(id: string | number, cambios: Partial<Usuario> & Record<string, unknown>): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.apiUrl}/api/admin/users/${id}`, cambios);
  }

  // Crea la usuaria y también su perfil y cuenta, para no dejar tablas huérfanas
  crearUsuaria(data: Record<string, any>): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.apiUrl}/usuarios`, data).pipe(
      switchMap((creada) =>
        forkJoin([
          this.http.post(`${this.apiUrl}/user_profile`, {
            user_id: creada.id,
            profile_photo_url: null,
            tutorial_completed: false,
            tutorial_seen_at: null,
            created_at: data['created_at'],
            updated_at: null,
          }),
          this.http.post(`${this.apiUrl}/account`, {
            user_id: creada.id,
            password_hash: data['password'], // solo mock
            status: 'active',
            last_access: null,
          }),
        ]).pipe(map(() => creada))
      )
    );
  }

  // ── Datos relacionados ───────────────────────────────────────
  // Todas las alertas (para calcular el contador por usuaria)
  getAlertas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/admin/alerts`);
  }

  getAlertasByUsuaria(usuarioId: string | number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/alerts/user/${usuarioId}`);
  }

  // user_profile_id coincide con el id de la usuaria
  getContactos(usuarioId: string | number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/contacts/user/${usuarioId}`);
  }
}