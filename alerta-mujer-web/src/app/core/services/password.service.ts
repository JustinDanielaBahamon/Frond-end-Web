import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Password change and recovery (recovery uses a 6-digit code sent by email). */
@Injectable({ providedIn: 'root' })
export class PasswordService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  change(current: string, newOne: string): Observable<void> {
    return this.http.put<void>(`${this.api}/api/users/me/password`, { currentPassword: current, newPassword: newOne });
  }

  requestCode(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/api/auth/forgot-password`, { email });
  }

  verifyCode(email: string, code: string): Observable<void> {
    return this.http.post<void>(`${this.api}/api/auth/verify-reset-code`, { email, code });
  }

  reset(email: string, code: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/api/auth/reset-password`, { email, code, newPassword });
  }
}

export type Requirement = { text: string; meets: boolean };

/** Visible requirements and strength level (0 to 4) of a password. */
export function evaluatePassword(key: string): { requirements: Requirement[]; level: number; label: string; valid: boolean } {
  const requirements: Requirement[] = [
    { text: 'Al menos 8 caracteres', meets: key.length >= 8 },
    { text: 'Una letra mayúscula', meets: /[A-ZÁÉÍÓÚÑ]/.test(key) },
    { text: 'Una letra minúscula', meets: /[a-záéíóúñ]/.test(key) },
    { text: 'Un número', meets: /\d/.test(key) },
  ];
  const met = requirements.filter((r) => r.meets).length;
  const level = key.length === 0 ? 0 : Math.max(1, met);
  const labels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];
  // The backend only requires 8 characters; the rest is recommended
  return { requirements, level, label: labels[level], valid: key.length >= 8 && key.length <= 100 };
}
