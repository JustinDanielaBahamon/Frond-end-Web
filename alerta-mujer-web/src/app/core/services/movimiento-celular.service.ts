import { Injectable, inject, signal } from '@angular/core';
import { PhoneLocationService } from './phone.location.services';
import { GeocodingService, Lugar } from './geocoding.service';

/** Lugar de referencia contra el que se compara la ubicación del celular. */
interface Referencia {
  lat: number;
  lng: number;
  lugar: string;
  avisadoEn: number;
}

export interface AvisoMovimiento {
  desde: string;
  hasta: string;
  hora: Date;
}

const CLAVE_ACTIVO = 'alerta-mujer-aviso-desplazamiento';
const CLAVE_REFERENCIA = 'alerta-mujer-referencia-celular';
const REVISAR_CADA_MS = 5 * 60 * 1000;
// Un desplazamiento menor se considera el mismo sitio (el GPS se mueve unos metros solo)
const DISTANCIA_MINIMA_M = 300;
// Como mucho un aviso cada 30 minutos aunque siga moviéndose
const AVISO_CADA_MS = 30 * 60 * 1000;

/**
 * "Notificaciones de ubicación": mientras la web está abierta, revisa la ubicación que envía el
 * celular y avisa a la propia usuaria (nunca a sus contactos) cuando se desplazó a otro lugar:
 * aviso en el panel, notificación del navegador y un sonido corto (un computador no vibra).
 */
@Injectable({ providedIn: 'root' })
export class MovimientoCelularService {
  private ubicacion = inject(PhoneLocationService);
  private geocoding = inject(GeocodingService);

  readonly activo = signal(leer(CLAVE_ACTIVO) !== 'false');
  readonly aviso = signal<AvisoMovimiento | null>(null);
  private reloj?: ReturnType<typeof setInterval>;

  iniciar(): void {
    this.detener();
    if (!this.activo()) return;
    this.revisar();
    this.reloj = setInterval(() => this.revisar(), REVISAR_CADA_MS);
  }

  detener(): void {
    if (this.reloj) clearInterval(this.reloj);
    this.reloj = undefined;
  }

  cambiarActivo(valor: boolean): void {
    this.activo.set(valor);
    guardar(CLAVE_ACTIVO, String(valor));
    if (valor) {
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
      this.iniciar();
    } else {
      this.detener();
      this.aviso.set(null);
    }
  }

  cerrarAviso(): void {
    this.aviso.set(null);
  }

  private revisar(): void {
    this.ubicacion.getLatest().subscribe({
      next: async (u) => {
        if (!u) return;
        const ref = this.referencia();
        if (!ref) {
          this.guardarReferencia(u.lat, u.lng, await this.nombreLugar(u.lat, u.lng), 0);
          return;
        }
        if (distanciaM(ref.lat, ref.lng, u.lat, u.lng) < DISTANCIA_MINIMA_M) return;
        if (Date.now() - ref.avisadoEn < AVISO_CADA_MS) return;
        const hasta = await this.nombreLugar(u.lat, u.lng);
        this.guardarReferencia(u.lat, u.lng, hasta, Date.now());
        this.avisar({ desde: ref.lugar, hasta, hora: u.recordedAt ? new Date(u.recordedAt) : new Date() });
      },
      error: () => {},
    });
  }

  private avisar(aviso: AvisoMovimiento): void {
    this.aviso.set(aviso);
    const texto = `Tu celular se desplazó de ${aviso.desde} y ahora está cerca de ${aviso.hasta}.`;
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Tu celular cambió de lugar', { body: texto, icon: '/email/logo.png', tag: 'movimiento-celular' });
    }
    sonar();
  }

  private async nombreLugar(lat: number, lng: number): Promise<string> {
    const lugar: Lugar | null = await this.geocoding.obtener(lat, lng);
    return (lugar && ([lugar.barrio, lugar.direccion].filter(Boolean).join(', ') || lugar.ciudad))
      || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  private referencia(): Referencia | null {
    try {
      return JSON.parse(leer(CLAVE_REFERENCIA) ?? 'null');
    } catch {
      return null;
    }
  }

  private guardarReferencia(lat: number, lng: number, lugar: string, avisadoEn: number): void {
    guardar(CLAVE_REFERENCIA, JSON.stringify({ lat, lng, lugar, avisadoEn } satisfies Referencia));
  }
}

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento el aviso funciona igual, solo se pierde al recargar
  }
}

/** Distancia en metros entre dos puntos (fórmula de Haversine). */
export function distanciaM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Dos tonos cortos (Web Audio: no necesita archivos de sonido). */
function sonar(): void {
  try {
    const ctx = new AudioContext();
    [0, 0.22].forEach((inicio, i) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.frequency.value = i === 0 ? 880 : 1175;
      vol.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
      vol.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + inicio + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + 0.2);
      osc.connect(vol).connect(ctx.destination);
      osc.start(ctx.currentTime + inicio);
      osc.stop(ctx.currentTime + inicio + 0.21);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    // El navegador puede bloquear el sonido hasta que la usuaria toque la página
  }
}
