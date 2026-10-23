import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface User {
  id: number;
  name: string;
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

/* Data coming from the registration form */
export interface UserRecord {
  name: string;
  telephone: string;
  documentType: string;
  documentNumber: string;
  birthDate: string; // DD/MM/AAAA
  email: string;
  password: string;
  /** Checked terms and privacy: the backend stores when and which version she accepted. */
  acceptsTerms: boolean;
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

  /*
 * Full registration: saves the user with all her data.
 *      Does not sign in: after registering she goes to the login.
 */
  registrar(data: UserRecord): Observable<User> {
    return this.http.post<{token: string, user: any}>(`${environment.apiUrl}/api/auth/register`, {
      nombre: data.name.trim(),
      email: data.email.trim(),
      password: data.password,
      telefono: data.telephone.trim(),
      tipoDocumento: data.documentType,
      numeroDocumento: data.documentNumber.trim(),
      fechaNacimiento: data.birthDate,
      aceptaTerminos: data.acceptsTerms
    }).pipe(
      map((response) => {
        const backendUser = response.user;
        const user: User = {
          id: backendUser.id,
          name: `${backendUser.firstName} ${backendUser.lastName}`,
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
        // 409 with fieldErrors: email, phone or document already used by another account
        const fields: Record<string, string> | undefined = error?.status === 409 ? error?.error?.fieldErrors : undefined;
        return throwError(() => Object.assign(new Error('No se pudo completar el registro'), { fields }));
      })
    );
  }

  /**
   * Signs out. It first tells the backend so it is audited
   * (voluntary or due to inactivity); if that call fails, the session is closed anyway.
   */
  logout(reason: 'voluntario' | 'inactividad' = 'voluntario'): void {
    const token = this.getToken();
    if (token) {
      this.http.post(`${environment.apiUrl}/api/auth/logout`, { reason: reason }, {
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

  /** There is a session only if a token exists and has not expired yet. */
  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    if (this.tokenExpired(token)) {
      this.signOutLocally();
      return false;
    }
    return true;
  }

  /** Milliseconds left in the web session (the token expires after 24 h), or null without a session. */
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

  /** Reads the JWT exp field (seconds). An unreadable token is treated as expired. */
  private tokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }

  /** Clears the session without navigating (used by the guard and the interceptor). */
  signOutLocally(): void {
    localStorage.removeItem(STORAGE_KEY);
    this._currentUser$.next(null);
    this._token$.next(null);
  }

  /** Updates the signed-in user's data (e.g. after editing her name) without touching the token. */
  updateCurrentUser(changes: Partial<User>): void {
    const current = this._currentUser$.value;
    const token = this._token$.value;
    if (!current || !token) return;
    const user: User = { ...current, ...changes };
    user.name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || current.name;
    this.saveSession(user, token);
    this._currentUser$.next(user);
  }

  /** Google sign-in: the backend validates the Firebase token and returns the JWT. */
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

  /** Adapts the backend response to the Angular User model and stores the session. */
  private signIn(response: { token: string; user: any }): User {
    const backendUser = response.user;
    const user: User = {
      id: backendUser.id,
      name: `${backendUser.firstName} ${backendUser.lastName}`.trim(),
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
