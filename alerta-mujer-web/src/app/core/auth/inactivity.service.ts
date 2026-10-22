import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';

const STORAGE_KEY = 'alerta-mujer-admin-inactividad';
const DEFAULT_MINUTES = 15;
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const;
const CHECK_MS = 15000;

/**
 * Cierra la sesión del panel tras X minutos sin uso (el panel muestra datos sensibles y
 * puede quedar abierto en un equipo compartido). 0 = desactivado. Se guarda por navegador.
 */
@Injectable({ providedIn: 'root' })
export class InactivityService {
  private authService = inject(AuthService);

  readonly options = [0, 5, 10, 15, 30, 60];
  readonly minutos = signal<number>(this.leer());

  private lastActivity = Date.now();
  private interval: ReturnType<typeof setInterval> | null = null;
  private readonly registrar = () => { this.lastActivity = Date.now(); };

  start(): void {
    if (this.interval) return;
    this.lastActivity = Date.now();
    EVENTS.forEach(e => document.addEventListener(e, this.registrar, { passive: true, capture: true }));
    this.interval = setInterval(() => this.review(), CHECK_MS);
  }

  stop(): void {
    EVENTS.forEach(e => document.removeEventListener(e, this.registrar, { capture: true }));
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  change(minutos: number): void {
    this.minutos.set(minutos);
    this.lastActivity = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, String(minutos));
    } catch {
      // Sin almacenamiento: el valor vale solo para esta pestaña
    }
  }

  private review(): void {
    const limit = this.minutos();
    if (limit > 0 && Date.now() - this.lastActivity >= limit * 60000) {
      this.stop();
      this.authService.logout('inactividad');
    }
  }

  private leer(): number {
    try {
      const value = Number(localStorage.getItem(STORAGE_KEY));
      return localStorage.getItem(STORAGE_KEY) !== null && this.options.includes(value) ? value : DEFAULT_MINUTES;
    } catch {
      return DEFAULT_MINUTES;
    }
  }
}
