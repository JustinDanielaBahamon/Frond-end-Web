import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';

const STORAGE_KEY = 'alerta-mujer-admin-inactividad';
const DEFAULT_MINUTOS = 15;
const EVENTOS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const;
const REVISION_MS = 15000;

/**
 * Cierra la sesión del panel tras X minutos sin uso (el panel muestra datos sensibles y
 * puede quedar abierto en un equipo compartido). 0 = desactivado. Se guarda por navegador.
 */
@Injectable({ providedIn: 'root' })
export class InactivityService {
  private authService = inject(AuthService);

  readonly opciones = [0, 5, 10, 15, 30, 60];
  readonly minutos = signal<number>(this.leer());

  private ultimaActividad = Date.now();
  private intervalo: ReturnType<typeof setInterval> | null = null;
  private readonly registrar = () => { this.ultimaActividad = Date.now(); };

  iniciar(): void {
    if (this.intervalo) return;
    this.ultimaActividad = Date.now();
    EVENTOS.forEach(e => document.addEventListener(e, this.registrar, { passive: true, capture: true }));
    this.intervalo = setInterval(() => this.revisar(), REVISION_MS);
  }

  detener(): void {
    EVENTOS.forEach(e => document.removeEventListener(e, this.registrar, { capture: true }));
    if (this.intervalo) clearInterval(this.intervalo);
    this.intervalo = null;
  }

  cambiar(minutos: number): void {
    this.minutos.set(minutos);
    this.ultimaActividad = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, String(minutos));
    } catch {
      // Sin almacenamiento: el valor vale solo para esta pestaña
    }
  }

  private revisar(): void {
    const limite = this.minutos();
    if (limite > 0 && Date.now() - this.ultimaActividad >= limite * 60000) {
      this.detener();
      this.authService.logout();
    }
  }

  private leer(): number {
    try {
      const valor = Number(localStorage.getItem(STORAGE_KEY));
      return localStorage.getItem(STORAGE_KEY) !== null && this.opciones.includes(valor) ? valor : DEFAULT_MINUTOS;
    } catch {
      return DEFAULT_MINUTOS;
    }
  }
}
