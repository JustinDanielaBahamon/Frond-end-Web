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

  currentUser$: Observable<User | null> = this._currentUser$.asObservable();

  login(credentials: LoginCredentials): Observable<User> {
    // Con JSON Server puro, obtenemos todos los usuarios y filtramos localmente
    return this.http.get<any[]>(`${environment.apiUrl}/usuarios`).pipe(
      map((usuarios) => {
        const found = usuarios.find(
          (u) =>
            (u.correo?.toLowerCase() === credentials.email.toLowerCase() ||
             u.email?.toLowerCase() === credentials.email.toLowerCase()) &&
            u.password === credentials.password
        );

        if (!found) {
          throw new Error('Credenciales incorrectas');
        }

        const { password: _pwd, ...user } = found;
        return user;
      }),
      tap((user) => {
        const token = `jwt-${user.id}-${Date.now()}`;
        this.saveSession(user, token);
        this._currentUser$.next(user);
      }),
      catchError((error) => {
        return throwError(() => new Error('Credenciales incorrectas'));
      })
    );
  }

  /* Registro completo: guarda a la usuaria con todos sus datos.
     No inicia sesión: después del registro se va al login. */
  registrar(data: RegistroUsuaria): Observable<User> {
    const [dia, mes, anio] = data.fechaNacimiento.split('/');
    const iso = `${anio}-${mes}-${dia}`;
    const partes = data.nombre.trim().split(/\s+/);

    const nuevoUsuario = {
      nombre: data.nombre.trim(),
      correo: data.correo.trim(),
      email: data.correo.trim(),
      password: data.password,
      telefono: data.telefono.trim(),
      fechaNacimiento: data.fechaNacimiento,
      municipio: 'Neiva',
      departamento: 'Huila',
      rol: 'Usuaria',
      estado: 'Activa',
      fechaRegistro: new Date().toLocaleDateString('es-CO'),
      ultimaActividad: 'recién registrada',
      alertas: 0,
      avatarColor: '#7c3aed',
      contactoEmergencia: 'N/A',
      role_id: 1,
      first_name: partes[0] || data.nombre,
      last_name: partes.slice(1).join(' '),
      document_type: data.tipoDocumento,
      document_number: data.numeroDocumento.trim(),
      birthdate: isNaN(Date.parse(iso)) ? null : iso,
      created_at: new Date().toISOString(),
    };

    return this.http.post<any>(`${environment.apiUrl}/usuarios`, nuevoUsuario).pipe(
      map(({ password: _pwd, ...user }) => user as User)
    );
  }

  registrarUsuaria(data: { nombre: string; email: string; rol: string }): void {
    // Con JSON Server puro, creamos el usuario directamente
    const nuevoUsuario = {
      nombre: data.nombre,
      correo: data.email,
      email: data.email,
      password: 'Default@123',
      telefono: '',
      fechaNacimiento: '',
      municipio: 'Neiva',
      departamento: 'Huila',
      rol: data.rol,
      estado: 'Activa',
      fechaRegistro: new Date().toLocaleDateString('es-CO'),
      ultimaActividad: 'recién registrado',
      alertas: 0,
      avatarColor: '#7c3aed',
      contactoEmergencia: 'N/A',
      role_id: 1,
      first_name: data.nombre.split(' ')[0] || data.nombre,
      last_name: data.nombre.split(' ').slice(1).join(' ') || '',
      document_number: '',
      document_type: '',
      birthdate: null,
      created_at: new Date().toISOString(),
    };

    this.http.post<any>(`${environment.apiUrl}/usuarios`, nuevoUsuario).subscribe({
      next: (response) => {
        const { password: _pwd, ...user } = response;
        const token = `jwt-${user.id}-${Date.now()}`;
        this.saveSession(user, token);
        this._currentUser$.next(user);
      },
      error: (err) => {
        console.error('Error al registrar:', err);
      },
    });
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