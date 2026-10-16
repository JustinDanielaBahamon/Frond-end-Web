import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Cambio y recuperación de contraseña (la recuperación usa un código de 6 dígitos enviado al correo). */
@Injectable({ providedIn: 'root' })
export class PasswordService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  cambiar(actual: string, nueva: string): Observable<void> {
    return this.http.put<void>(`${this.api}/api/users/me/password`, { currentPassword: actual, newPassword: nueva });
  }

  pedirCodigo(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/api/auth/forgot-password`, { email });
  }

  verificarCodigo(email: string, code: string): Observable<void> {
    return this.http.post<void>(`${this.api}/api/auth/verify-reset-code`, { email, code });
  }

  restablecer(email: string, code: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/api/auth/reset-password`, { email, code, newPassword });
  }
}

export type Requisito = { texto: string; cumple: boolean };

/** Requisitos visibles y nivel de seguridad (0 a 4) de una contraseña. */
export function evaluarContrasena(clave: string): { requisitos: Requisito[]; nivel: number; etiqueta: string; valida: boolean } {
  const requisitos: Requisito[] = [
    { texto: 'Al menos 8 caracteres', cumple: clave.length >= 8 },
    { texto: 'Una letra mayúscula', cumple: /[A-ZÁÉÍÓÚÑ]/.test(clave) },
    { texto: 'Una letra minúscula', cumple: /[a-záéíóúñ]/.test(clave) },
    { texto: 'Un número', cumple: /\d/.test(clave) },
  ];
  const cumplidos = requisitos.filter((r) => r.cumple).length;
  const nivel = clave.length === 0 ? 0 : Math.max(1, cumplidos);
  const etiquetas = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];
  // El backend solo exige 8 caracteres; el resto se recomienda
  return { requisitos, nivel, etiqueta: etiquetas[nivel], valida: clave.length >= 8 && clave.length <= 100 };
}
