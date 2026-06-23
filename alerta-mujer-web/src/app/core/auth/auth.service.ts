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

const fake_users = [
  {
    id: 1,
    nombre: 'Admin Alerta',
    email: 'admin',
    password: '123456',
    rol: 'admin',
    token: 'fake-jwt-token-admin-001',
  },
  {
    id: 2,
    nombre: 'Usuario',
    email: 'usuario',
    password: '123456',
    rol: 'operador',
    token: 'fake-jwt-token-sebas-002',
  },
];

const STORAGE_KEY = 'alerta_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);

  private _currentUser$ = new BehaviorSubject<User | null>(this.loadSession());

  currentUser$: Observable<User | null> = this._currentUser$.asObservable();

  login(credentials: LoginCredentials): Observable<User> {
    const found = fake_users.find(
      (u) => u.email === credentials.email && u.password === credentials.password
    );

    if (!found) {
      return throwError(() => new Error('Credenciales incorrectas'));
    }

    const { password, token, ...user } = found;

    return of(user).pipe(
      delay(800),
      tap((u) => {
        this.saveSession(u, token);
        this._currentUser$.next(u);
      })
    );
  }
registrarUsuaria(data: { nombre: string; email: string; rol: string }): void {
  const nuevaUsuaria: User = {
    id: Date.now(),
    nombre: data.nombre,
    email: data.email,
    rol: data.rol,       // ← siempre 'operador' para registro normal
  };
  const token = `fake-token-${Date.now()}`;
  this.saveSession(nuevaUsuaria, token);
  this._currentUser$.next(nuevaUsuaria);
}
  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this._currentUser$.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw).token ?? null;
  }

  getRol(): string {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return '';
    return JSON.parse(raw).user?.rol ?? '';
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