import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

  // Crea la usuaria desde el backend (cuenta + perfil + token)
  crearUsuaria(data: Record<string, any>): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.apiUrl}/api/auth/register`, {
      nombre: data['nombre'] ?? data['name'],
      email: data['email'] ?? data['correo'],
      password: data['password'],
      telefono: data['telefono'] ?? data['telephone'],
    });
  }

  // ── Perfil de la usuaria autenticada (UserController) ──
  getMe(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/users/me`);
  }

  updateMe(cambios: Record<string, unknown>): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/api/users/me`, cambios);
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