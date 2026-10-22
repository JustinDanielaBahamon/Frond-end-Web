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
  role: string;
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
export interface UserRecord {
  nombre: string;
  telefono: string;
  tipoDocumento: string;
  numeroDocumento: string;
  fechaNacimiento: string; // DD/MM/AAAA
  email: string;
  password: string;
  /** Marcó términos y privacidad: el backend guarda cuándo y qué versión aceptó. */
  aceptaTerminos: boolean;
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
      map((response) => this.signIn(response)),
      catchError((error) => {
        console.error('Error en login:', error);
        return throwError(() => new Error('Credenciales incorrectas'));
      })
    );
  }

  /* Registro completo: guarda a la usuaria con todos sus datos.
     No inicia sesión: después del registro se va al login. */
  registrar(data: UserRecord): Observable<User> {
    return this.http.post<{token: string, user: any}>(`${environment.apiUrl}/api/auth/register`, {
      nombre: data.nombre.trim(),
      email: data.email.trim(),
      password: data.password,
      telefono: data.telefono.trim(),
      tipoDocumento: data.tipoDocumento,
      numeroDocumento: data.numeroDocumento.trim(),
      fechaNacimiento: data.fechaNacimiento,
      aceptaTerminos: data.aceptaTerminos
    }).pipe(
      map((response) => {
        const backendUser = response.user;
        const user: User = {
          id: backendUser.id,
          nombre: `${backendUser.firstName} ${backendUser.lastName}`,
          email: backendUser.email,
          role: backendUser.roleId === 2 ? 'Admin' : 'Usuaria',
          firstName: backendUser.firstName,
          lastName: backendUser.lastName,
          telephone: backendUser.telephone,
          roleId: backendUser.roleId
        };
        return user;
      }),
      catchError((error) => {
        console.error('Error en registro:', error?.status);
        // 409 con fieldErrors: correo, teléfono o documento que ya usa otra cuenta
        const campos: Record<string, string> | undefined = error?.status === 409 ? error?.error?.fieldErrors : undefined;
        return throwError(() => Object.assign(new Error('No se pudo completar el registro'), { campos }));
      })
    );
  }

  /**
   * Cierra la sesión. Antes avisa al backend para que quede en la auditoría
   * (voluntario o por inactividad); si el aviso falla, la sesión se cierra igual.
   */
  logout(motivo: 'voluntario' | 'inactividad' = 'voluntario'): void {
    const token = this.getToken();
    if (token) {
      this.http.post(`${environment.apiUrl}/api/auth/logout`, { reason: motivo }, {
        headers: { Authorization: `Bearer ${token}` }
      }).subscribe({ error: () => {} });
    }
    this.signOutLocally();
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return this._token$.value;
  }

  getCurrentUser(): User | null {
    return this._currentUser$.value;
  }

  getRole(): string {
    const user = this._currentUser$.value;
    return user?.role ?? '';
  }

  /** Hay sesión solo si existe un token y todavía no ha vencido. */
  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    if (this.tokenExpired(token)) {
      this.signOutLocally();
      return false;
    }
    return true;
  }

  /** Milisegundos que le quedan a la sesión de la web (el token vence a las 24 h), o null sin sesión. */
  remainingTimeMs(): number | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp === 'number' ? Math.max(0, payload.exp * 1000 - Date.now()) : null;
    } catch {
      return null;
    }
  }

  /** Lee el campo exp del JWT (segundos). Un token ilegible se trata como vencido. */
  private tokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }

  /** Borra la sesión sin navegar (lo usan el guard y el interceptor). */
  signOutLocally(): void {
    localStorage.removeItem(STORAGE_KEY);
    this._currentUser$.next(null);
    this._token$.next(null);
  }

  /** Actualiza los datos de la usuaria en sesión (p. ej. tras editar su nombre) sin tocar el token. */
  updateCurrentUser(changes: Partial<User>): void {
    const current = this._currentUser$.value;
    const token = this._token$.value;
    if (!current || !token) return;
    const user: User = { ...current, ...changes };
    user.nombre = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || current.nombre;
    this.saveSession(user, token);
    this._currentUser$.next(user);
  }

  /** Inicio de sesión con Google: el backend valida el token de Firebase y entrega el JWT. */
  loginWithGoogle(idToken: string): Observable<User> {
    return this.http
      .post<{ token: string; user: any }>(`${environment.apiUrl}/api/auth/google`, { idToken })
      .pipe(
        map((response) => this.signIn(response)),
        catchError((error) => {
          const message = error?.error?.message === 'Account blocked'
            ? 'Tu cuenta está bloqueada. Contacta al administrador.'
            : 'No se pudo iniciar sesión con Google. Intenta de nuevo.';
          return throwError(() => new Error(message));
        })
      );
  }

  /** Adapta la respuesta del backend al modelo User de Angular y guarda la sesión. */
  private signIn(response: { token: string; user: any }): User {
    const backendUser = response.user;
    const user: User = {
      id: backendUser.id,
      nombre: `${backendUser.firstName} ${backendUser.lastName}`.trim(),
      email: backendUser.email,
      role: backendUser.roleId === 2 ? 'Admin' : 'Usuaria',
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
