import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ContinuousPlayerComponent } from '../../shared/components/reproductor-continuo/reproductor-continuo';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import { AlertMessage, Tracking, TrackingService } from '../../core/services/tracking.service';
import { GeocodingService, Place } from '../../core/services/geocoding.service';

const REFRESH_MS = 10000;

const CHAT_REFRESH_MS = 5000;
const NAME_KEY = 'alerta-mujer-nombre-contacto';

/** Contact quick replies (one tap, like the app quick messages). */
export const QUICK_REPLIES = [
  'Voy en camino',
  'Ya llamé a la policía',
  '¿Dónde estás?',
  '¿Estás bien?',
  'Mantén la calma, ya vamos',
];

const START_COLOR = '#7c3aed';
const CURRENT_COLOR = '#d946ef';

/** Distancia en km entre dos puntos (Haversine). */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const durationText = (ms: number): string => {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 1) return 'menos de 1 min';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
};

/**
 * Public screen an emergency contact opens from the email: alert status, map
 * with the route, address of the last location, recorded evidence, what to do and quick
 * links to call or get to the place.
 */
@Component({
  selector: 'app-tracking',
  standalone: true,
  imports: [CommonModule, ContinuousPlayerComponent],
  templateUrl: './tracking.html',
  styleUrl: './tracking.scss',
})
export class TrackingComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  /**
   * true if it came from the panel "Alertas de mis contactos" with a session: only then
   * is going back offered. From the email link there is nowhere to go back to.
   */
  readonly fromPanel = typeof history !== 'undefined' && history.state?.desdePanel === true;

  backToPanel(): void {
    this.router.navigate(['/dashboard/alertas-contactos']);
  }
  private trackingService = inject(TrackingService);
  private geocoding = inject(GeocodingService);
  private destroyRef = inject(DestroyRef);

  readonly data = signal<Tracking | null>(null);
  readonly error = signal('');
  readonly loading = signal(true);
  readonly wakingUp = signal(false);
  readonly now = signal(Date.now());

  readonly last = computed(() => {
    const r = this.data()?.route ?? [];
    return r.length ? r[r.length - 1] : null;
  });

  readonly howLongAgo = computed(() => {
    const u = this.last();
    if (!u) return '';
    const min = Math.max(0, Math.round((this.now() - u.time.getTime()) / 60000));
    return min === 0 ? 'hace menos de un minuto' : min === 1 ? 'hace 1 minuto' : `hace ${min} minutos`;
  });

  readonly mapsUrl = computed(() => {
    const u = this.last();
    return u ? `https://www.google.com/maps/search/?api=1&query=${u.lat},${u.lng}` : '';
  });
  /** Google Maps route from where the contact is to the last location. */
  readonly directionsUrl = computed(() => {
    const u = this.last();
    return u ? `https://www.google.com/maps/dir/?api=1&destination=${u.lat},${u.lng}` : '';
  });
  /** Address and neighborhood of the last location (OpenStreetMap). */
  readonly place = signal<Place | null>(null);
  readonly zone = computed(() => [this.place()?.neighborhood, this.place()?.city].filter(Boolean).join(', '));
  readonly duration = computed(() => {
    const d = this.data();
    if (!d?.start) return '';
    const end = d.end ?? new Date(this.now());
    return durationText(end.getTime() - d.start.getTime());
  });
  readonly routeKm = computed(() => {
    const r = this.data()?.route ?? [];
    let total = 0;
    for (let i = 1; i < r.length; i++) total += distanceKm(r[i - 1], r[i]);
    return total;
  });
  /** Route for the timeline: newest to first (at most 20). */
  readonly routeList = computed(() => {
    const r = this.data()?.route ?? [];
    return r
      .map((p, i) => ({ ...p, number: i + 1, isCurrent: i === r.length - 1 }))
      .reverse()
      .slice(0, 20);
  });
  /** Neighborhood and address of each point (rounded "lat,lng" -> text). */
  readonly pointPlaces = signal<Record<string, string>>({});
  readonly videos = computed(() => (this.data()?.evidences ?? []).filter((e) => e.type === 'video'));
  readonly audios = computed(() => (this.data()?.evidences ?? []).filter((e) => e.type === 'audio'));
  private placeKey = '';

  // ── Alert chat ──
  readonly quickReplies = QUICK_REPLIES;
  readonly messages = signal<AlertMessage[]>([]);
  readonly contactName = signal(this.readName());
  readonly draftName = signal('');
  readonly messageText = signal('');
  readonly sending = signal(false);
  readonly errorChat = signal('');
  private chatTimer: ReturnType<typeof setInterval> | null = null;

  private code = '';
  private map: L.Map | null = null;
  private layer: L.LayerGroup | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private firstView = true;

  ngOnInit(): void {
    this.code = this.route.snapshot.paramMap.get('codigo') ?? '';
    // If the server (free Render) was asleep, the first response may take a while
    const notice = setTimeout(() => this.wakingUp.set(true), 4000);
    this.query(() => clearTimeout(notice));
    this.destroyRef.onDestroy(() => {
      if (this.timer) clearInterval(this.timer);
      if (this.chatTimer) clearInterval(this.chatTimer);
      this.map?.remove();
    });
  }

  private query(onEnd?: () => void): void {
    this.trackingService.query(this.code).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        onEnd?.();
        this.data.set(d);
        this.error.set('');
        this.loading.set(false);
        this.wakingUp.set(false);
        this.now.set(Date.now());
        setTimeout(() => this.paintMap(d));
        this.searchPlace();
        this.searchPointPlaces();
        this.refreshChat(d.active);
        if (d.active && !this.timer) {
          this.timer = setInterval(() => this.query(), REFRESH_MS);
        } else if (!d.active && this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
      },
      error: (err) => {
        onEnd?.();
        this.loading.set(false);
        this.wakingUp.set(false);
        if (err?.status === 404) {
          this.error.set('Este enlace no existe o ya venció. Los enlaces dejan de funcionar 2 horas después de que termina la alerta.');
          if (this.timer) clearInterval(this.timer);
          this.timer = null;
        } else if (!this.data()) {
          this.error.set('No se pudo conectar con AlertaMujer. Revisa tu conexión e inténtalo de nuevo.');
        }
        // With data already shown, a one-off failure does not clear the screen: the next attempt updates it
      },
    });
  }

  static keyOf(p: { lat: number; lng: number }): string {
    return `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
  }

  /** For the template. */
  keyOf(p: { lat: number; lng: number }): string {
    return TrackingComponent.keyOf(p);
  }

  /** Address of the most recent points (OpenStreetMap: one query per second, cached). */
  private searchPointPlaces(): void {
    for (const p of this.routeList().slice(0, 8)) {
      const key = TrackingComponent.keyOf(p);
      if (this.pointPlaces()[key] !== undefined) continue;
      this.pointPlaces.update((l) => ({ ...l, [key]: '' }));
      this.geocoding.get(p.lat, p.lng).then((place) => {
        const text = [place?.address, place?.neighborhood].filter(Boolean).join(' · ');
        this.pointPlaces.update((l) => ({ ...l, [key]: text }));
      });
    }
  }

  /** Looks up the address only when the last location changed (~11 m). */
  private searchPlace(): void {
    const u = this.last();
    if (!u) return;
    const key = `${u.lat.toFixed(4)},${u.lng.toFixed(4)}`;
    if (key === this.placeKey) return;
    this.placeKey = key;
    this.geocoding.get(u.lat, u.lng).then((l) => {
      if (key === this.placeKey) this.place.set(l);
    });
  }

  /** Takes the map to the person's current position, with street zoom. */
  centerOnPerson(): void {
    const u = this.last();
    if (u && this.map) this.map.flyTo([u.lat, u.lng], 17, { duration: 0.8 });
  }

  /** Vuelve a encuadrar todo el recorrido. */
  center(): void {
    const d = this.data();
    if (d) this.frame(d);
  }

  private frame(d: Tracking): void {
    if (!this.map || !d.route.length) return;
    const points = d.route.map((p) => L.latLng(p.lat, p.lng));
    if (points.length === 1) this.map.setView(points[0], 16);
    else this.map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 17 });
  }

  // New messages every 5 s while the alert is active (when it ends, one last read)
  private refreshChat(active: boolean): void {
    this.readNewMessages();
    if (active && !this.chatTimer) {
      this.chatTimer = setInterval(() => this.readNewMessages(), CHAT_REFRESH_MS);
    } else if (!active && this.chatTimer) {
      clearInterval(this.chatTimer);
      this.chatTimer = null;
    }
  }

  private readNewMessages(): void {
    const last = this.messages().at(-1)?.id ?? 0;
    this.trackingService.messages(this.code, last).subscribe({
      next: (newOnes) => {
        if (newOnes.length) this.addMessages(newOnes);
      },
      error: () => {
        // A one-off failure does not clear the chat: retried on the next read
      },
    });
  }

  private addMessages(newOnes: AlertMessage[]): void {
    const ids = new Set(this.messages().map((m) => m.id));
    this.messages.update((currentOnes) => [...currentOnes, ...newOnes.filter((m) => !ids.has(m.id))]);
    setTimeout(() => document.getElementById('chat-lista')?.scrollTo({ top: 1e6, behavior: 'smooth' }));
  }

  saveName(): void {
    const name = this.draftName().trim().slice(0, 60);
    if (!name) return;
    this.contactName.set(name);
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      // private mode: it will be asked again next time
    }
  }

  send(text: string): void {
    const body = text.trim();
    if (!body || this.sending() || !this.contactName()) return;
    this.sending.set(true);
    this.errorChat.set('');
    this.trackingService.sendMessage(this.code, this.contactName(), body).subscribe({
      next: (m) => {
        this.addMessages([m]);
        this.messageText.set('');
        this.sending.set(false);
      },
      error: (e) => {
        this.sending.set(false);
        this.errorChat.set(e?.error?.message || 'No se pudo enviar el mensaje. Intenta de nuevo.');
      },
    });
  }

  private readName(): string {
    try {
      return localStorage.getItem(NAME_KEY) ?? '';
    } catch {
      return '';
    }
  }

  retry(): void {
    this.error.set('');
    this.loading.set(true);
    this.query();
  }

  private paintMap(d: Tracking): void {
    const container = document.getElementById('mapa-seguimiento');
    if (!container || !d.route.length) return;
    if (!this.map) {
      this.map = L.map(container, { zoomControl: true, attributionControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(this.map);
      this.layer = L.layerGroup().addTo(this.map);
    }
    this.layer!.clearLayers();
    const points = d.route.map((p) => L.latLng(p.lat, p.lng));
    // Same as in the app: dotted line and a numbered pin for each sent location
    if (points.length > 1) {
      L.polyline(points, { color: START_COLOR, weight: 3, opacity: 0.85, dashArray: '6 8', lineCap: 'round' }).addTo(this.layer!);
    }
    const u = points[points.length - 1];
    const precision = d.route[d.route.length - 1].precision;
    if (precision && precision > 0) {
      L.circle(u, { radius: precision, color: CURRENT_COLOR, weight: 1, fillOpacity: 0.12 }).addTo(this.layer!);
    }
    d.route.forEach((p, i) => {
      const isLast = i === d.route.length - 1;
      const icon = L.divIcon({
        className: '',
        html: `<span class="pin-ruta${isLast ? ' pin-ruta--actual' : i === 0 ? ' pin-ruta--inicio' : ''}">${i + 1}</span>`,
        iconSize: isLast ? [34, 34] : [24, 24],
        iconAnchor: isLast ? [17, 17] : [12, 12],
      });
      const time = p.time.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
      L.marker([p.lat, p.lng], { icon, zIndexOffset: isLast ? 1000 : i })
        .bindTooltip(`${isLast ? 'Última ubicación' : i === 0 ? 'Inicio' : `Punto ${i + 1}`} · ${time}`)
        .addTo(this.layer!);
    });
    // The first time the whole route is shown; afterwards only the current position is followed
    if (this.firstView) {
      this.frame(d);
      this.firstView = false;
    } else {
      this.map.panTo(u);
    }
    this.map.invalidateSize();
  }
}
