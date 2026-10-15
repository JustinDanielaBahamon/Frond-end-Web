import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
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
      map((response) => this.iniciarSesion(response)),
      catchError((error) => {
        console.error('Error en login:', error);
        return throwError(() => new Error('Credenciales incorrectas'));
      })
    );
  }

  /* Registro completo: guarda a la usuaria con todos sus datos.
     No inicia sesión: después del registro se va al login. */
  registrar(data: RegistroUsuaria): Observable<User> {
    return this.http.post<{token: string, user: any}>(`${environment.apiUrl}/api/auth/register`, {
      nombre: data.nombre.trim(),
      email: data.correo.trim(),
      password: data.password,
      telefono: data.telefono.trim(),
      tipoDocumento: data.tipoDocumento,
      numeroDocumento: data.numeroDocumento.trim(),
      fechaNacimiento: data.fechaNacimiento
    }).pipe(
      map((response) => {
        const backendUser = response.user;
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
        return user;
      }),
      catchError((error) => {
        console.error('Error en registro:', error);
        return throwError(() => new Error('No se pudo completar el registro'));
      })
    );
  }

  logout(): void {
    this.cerrarSesionLocal();
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return this._token$.value;
  }

  getCurrentUser(): User | null {
    return this._currentUser$.value;
  }

  getRol(): string {
    const user = this._currentUser$.value;
    return user?.rol ?? '';
  }

  /** Hay sesión solo si existe un token y todavía no ha vencido. */
  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    if (this.tokenVencido(token)) {
      this.cerrarSesionLocal();
      return false;
    }
    return true;
  }

  /** Lee el campo exp del JWT (segundos). Un token ilegible se trata como vencido. */
  private tokenVencido(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }

  /** Borra la sesión sin navegar (lo usan el guard y el interceptor). */
  cerrarSesionLocal(): void {
    localStorage.removeItem(STORAGE_KEY);
    this._currentUser$.next(null);
    this._token$.next(null);
  }

  /** Inicio de sesión con Google: el backend valida el token de Firebase y entrega el JWT. */
  loginWithGoogle(idToken: string): Observable<User> {
    return this.http
      .post<{ token: string; user: any }>(`${environment.apiUrl}/api/auth/google`, { idToken })
      .pipe(
        map((response) => this.iniciarSesion(response)),
        catchError((error) => {
          const mensaje = error?.error?.message === 'Account blocked'
            ? 'Tu cuenta está bloqueada. Contacta al administrador.'
            : 'No se pudo iniciar sesión con Google. Intenta de nuevo.';
          return throwError(() => new Error(mensaje));
        })
      );
  }

  /** Adapta la respuesta del backend al modelo User de Angular y guarda la sesión. */
  private iniciarSesion(response: { token: string; user: any }): User {
    const backendUser = response.user;
    const user: User = {
      id: backendUser.id,
      nombre: `${backendUser.firstName} ${backendUser.lastName}`.trim(),
      email: backendUser.email,
      rol: backendUser.roleId === 2 ? 'Admin' : 'Usuaria',
      firstName: backendUser.firstName,
      lastName: backendUser.lastName,
      telephone: backendUser.telephone,
      roleId: backendUser.roleId,
    };
    this.saveSession(user, response.token);
    this._currentUser$.next(user);
    this._token$.next(response.token);
    return user;
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
}
