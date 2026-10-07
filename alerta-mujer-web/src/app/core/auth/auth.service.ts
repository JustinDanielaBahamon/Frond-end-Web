import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay, tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface User {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  firstName?: string;
  lastName?: string;
  telephone?: string;
  roleId?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

/* Datos que llegan desde el formulario de registro */
export interface RegistroUsuaria {
  nombre: string;
  telefono: string;
  tipoDocumento: string;
  numeroDocumento: string;
  fechaNacimiento: string; // DD/MM/AAAA
  correo: string;
  password: string;
}

const STORAGE_KEY = 'alerta_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  private http = inject(HttpClient);

  private _currentUser$ = new BehaviorSubject<User | null>(this.loadSession());
  private _token$ = new BehaviorSubject<string | null>(this.loadToken());

  currentUser$: Observable<User | null> = this._currentUser$.asObservable();
  token$: Observable<string | null> = this._token$.asObservable();

  login(credentials: LoginCredentials): Observable<User> {
    // Conectar al backend Spring Boot
    return this.http.post<{token: string, user: any}>(`${environment.apiUrl}/api/auth/login`, {
      email: credentials.email,
      password: credentials.password
    }).pipe(
      map((response) => {
        const backendUser = response.user;
        
        // Adaptar el formato del backend al modelo User de Angular
        const user: User = {
          id: backendUser.id,
          nombre: `${backendUser.firstName} ${backendUser.lastName}`,
          email: backendUser.email,
          rol: backendUser.roleId === 2 ? 'Admin' : 'Usuaria',
          firstName: backendUser.firstName,
          lastName: backendUser.lastName,
          telephone: backendUser.telephone,
          roleId: backendUser.roleId
        };
        
        this.saveSession(user, response.token);
        this._currentUser$.next(user);
        this._token$.next(response.token);
        
        return user;
      }),
      catchError((error) => {
        console.error('Error en login:', error);
        return throwError(() => new Error('Credenciales incorrectas'));
      })
    );
  }

  /* Registro completo: usa el mismo endpoint del backend que la app móvil.
     Después del registro se va al login. */
  registrar(data: RegistroUsuaria): Observable<User> {
    return this.http.post<{token: string, user: any}>(`${environment.apiUrl}/api/auth/register`, {
      nombre: data.nombre.trim(),
      email: data.correo.trim(),
      password: data.password,
      telefono: data.telefono.trim(),
    }).pipe(
      map((response) => {
        const backendUser = response.user;
        return {
          id: backendUser.id,
          nombre: `${backendUser.firstName} ${backendUser.lastName}`,
          email: backendUser.email,
          rol: backendUser.roleId === 2 ? 'Admin' : 'Usuaria',
          firstName: backendUser.firstName,
          lastName: backendUser.lastName,
          telephone: backendUser.telephone,
          roleId: backendUser.roleId
        } as User;
      })
    );
  }

  registrarUsuaria(data: { nombre: string; email: string; rol: string; password?: string; telefono?: string }): void {
    // Conectar al backend Spring Boot
    this.http.post<{token: string, user: any}>(`${environment.apiUrl}/api/auth/register`, {
      nombre: data.nombre,
      email: data.email,
      password: data.password ?? 'Default@123', // Contraseña por defecto solo si no se envía
      telefono: data.telefono ?? ''
    }).subscribe({
      next: (response) => {
        const backendUser = response.user;
        
        // Adaptar el formato del backend al modelo User de Angular
        const user: User = {
          id: backendUser.id,
          nombre: `${backendUser.firstName} ${backendUser.lastName}`,
          email: backendUser.email,
          rol: backendUser.roleId === 2 ? 'Admin' : 'Usuaria',
          firstName: backendUser.firstName,
          lastName: backendUser.lastName,
          telephone: backendUser.telephone,
          roleId: backendUser.roleId
        };
        
        this.saveSession(user, response.token);
        this._currentUser$.next(user);
        this._token$.next(response.token);
      },
      error: (err) => {
        console.error('Error al registrar:', err);
      },
    });
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this._currentUser$.next(null);
    this._token$.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this._token$.value;
  }

  getRol(): string {
    const user = this._currentUser$.value;
    return user?.rol ?? '';
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  private saveSession(user: User, token: string): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
  }

  private loadSession(): User | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw).user ?? null;
  }

  private loadToken(): string | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw).token ?? null;
  }

  /** Actualiza la usuaria en sesión después de editar el perfil. */
  actualizarUsuaria(cambios: Partial<User>): void {
    const actual = this._currentUser$.value;
    const token = this._token$.value;
    if (!actual) return;
    const usuario: User = { ...actual, ...cambios };
    this._currentUser$.next(usuario);
    if (token) {
      this.saveSession(usuario, token);
    }
  }
}
