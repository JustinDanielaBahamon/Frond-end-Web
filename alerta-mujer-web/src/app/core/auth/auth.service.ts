import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay, tap } from 'rxjs/operators';

export interface User {
  id: number;
  nombre: string;
  email: string;
  rol: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// aca estan los usuarios usuarios falsos para las pruebas
const fake_users = [
  {
    id: 1,
    nombre: 'Admin Alerta',
    email: 'admin@alertamujer.com',
    password: '123456',
    rol: 'admin',
    token: 'fake-jwt-token-admin-001',
  },
  {
    id: 2,
    nombre: 'Sebastián',
    email: 'sebas@alertamujer.com',
    password: '123456',
    rol: 'operador',
    token: 'fake-jwt-token-sebas-002',
  },
];

const STORAGE_KEY = 'alerta_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);

  private _currentUser$ = new BehaviorSubject<User | null>(
    this.loadSession()
  );

  currentUser$: Observable<User | null> = this._currentUser$.asObservable();

  // inicio de sesion falso
  login(credentials: LoginCredentials): Observable<User> {
    const found = fake_users.find(
      (u) =>
        u.email === credentials.email &&
        u.password === credentials.password
    );

    if (!found) {
      return throwError(() => new Error('Credenciales incorrectas'));
    }

    const { password, token, ...user } = found;

    return of(user).pipe(
      delay(800),
      tap((u) => {
        this.saveSession(u, token); // guardar sesion
        this._currentUser$.next(u);
      })
    );
  }

  // cerrar sesion
  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this._currentUser$.next(null);
    this.router.navigate(['/login']);
  }

  // ayudantes de sesion
  getToken(): string | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw).token ?? null;
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
}