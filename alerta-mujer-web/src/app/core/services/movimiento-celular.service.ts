import { Injectable, inject, signal } from '@angular/core';
import { PhoneLocationService } from './phone.location.services';
import { GeocodingService, Place } from './geocoding.service';

/** Reference place against which the phone location is compared. */
interface Reference {
  lat: number;
  lng: number;
  place: string;
  notifiedAt: number;
}

export interface MovementNotice {
  from: string;
  to: string;
  time: Date;
}

const ACTIVE_KEY = 'alerta-mujer-aviso-desplazamiento';
const REFERENCE_KEY = 'alerta-mujer-referencia-celular';
const CHECK_EVERY_MS = 5 * 60 * 1000;
// A smaller movement counts as the same place (the GPS drifts a few meters by itself)
const MIN_DISTANCE_M = 300;
// At most one notice every 30 minutes even if it keeps moving
const NOTICE_EVERY_MS = 30 * 60 * 1000;

/**
 * "Location notifications": while the web is open, it checks the location the
 * phone sends and warns the user herself (never her contacts) when it moved to another place:
 * notice in the panel, browser notification and a short sound (a computer does not vibrate).
 */
@Injectable({ providedIn: 'root' })
export class PhoneMovementService {
  private location = inject(PhoneLocationService);
  private geocoding = inject(GeocodingService);

  readonly active = signal(leer(ACTIVE_KEY) !== 'false');
  readonly notice = signal<MovementNotice | null>(null);
  private clock?: ReturnType<typeof setInterval>;

  start(): void {
    this.stop();
    if (!this.active()) return;
    this.review();
    this.clock = setInterval(() => this.review(), CHECK_EVERY_MS);
  }

  stop(): void {
    if (this.clock) clearInterval(this.clock);
    this.clock = undefined;
  }

  toggleActive(value: boolean): void {
    this.active.set(value);
    save(ACTIVE_KEY, String(value));
    if (value) {
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
      this.start();
    } else {
      this.stop();
      this.notice.set(null);
    }
  }

  closeNotice(): void {
    this.notice.set(null);
  }

  private review(): void {
    this.location.getLatest().subscribe({
      next: async (u) => {
        if (!u) return;
        const ref = this.reference();
        if (!ref) {
          this.saveReference(u.lat, u.lng, await this.placeName(u.lat, u.lng), 0);
          return;
        }
        if (distanceM(ref.lat, ref.lng, u.lat, u.lng) < MIN_DISTANCE_M) return;
        if (Date.now() - ref.notifiedAt < NOTICE_EVERY_MS) return;
        const to = await this.placeName(u.lat, u.lng);
        this.saveReference(u.lat, u.lng, to, Date.now());
        this.notify({ from: ref.place, to, time: u.recordedAt ? new Date(u.recordedAt) : new Date() });
      },
      error: () => {},
    });
  }

  private notify(notice: MovementNotice): void {
    this.notice.set(notice);
    const text = `Tu celular se desplazó de ${notice.from} y ahora está cerca de ${notice.to}.`;
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Tu celular cambió de lugar', { body: text, icon: '/email/logo.png', tag: 'movimiento-celular' });
    }
    sonar();
  }

  private async placeName(lat: number, lng: number): Promise<string> {
    const place: Place | null = await this.geocoding.get(lat, lng);
    return (place && ([place.neighborhood, place.address].filter(Boolean).join(', ') || place.city))
      || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  private reference(): Reference | null {
    try {
      return JSON.parse(leer(REFERENCE_KEY) ?? 'null');
    } catch {
      return null;
    }
  }

  private saveReference(lat: number, lng: number, place: string, notifiedAt: number): void {
    save(REFERENCE_KEY, JSON.stringify({ lat, lng, place, notifiedAt } satisfies Reference));
  }
}

function leer(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Without storage the notice still works, it is just lost when reloading
  }
}

/** Distance in meters between two points (Haversine formula). */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Two short tones (Web Audio: needs no sound files). */
function sonar(): void {
  try {
    const ctx = new AudioContext();
    [0, 0.22].forEach((start, i) => {
      const dark = ctx.createOscillator();
      const vol = ctx.createGain();
      dark.frequency.value = i === 0 ? 880 : 1175;
      vol.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      vol.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.2);
      dark.connect(vol).connect(ctx.destination);
      dark.start(ctx.currentTime + start);
      dark.stop(ctx.currentTime + start + 0.21);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    // The browser may block the sound until the user touches the page
  }
}
