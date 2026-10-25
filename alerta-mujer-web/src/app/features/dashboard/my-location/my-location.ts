import {
  AfterViewInit, Component, ElementRef, Injector, OnDestroy, OnInit, ViewChild,
  computed, effect, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { zoneIcon } from '../../../core/utils/zone-icon';
import { PhoneLocationService } from '../../../core/services/phone.location.services';
import { ZonesService } from '../../../core/services/zones.service';
import { FrequentPlaceService } from '../../../core/services/frequent-places.service';
import { RoutesService } from '../../../core/services/saved-routes.service';
import { AuthService } from '../../../core/auth/auth.service';
import { GeocodingService, Place } from '../../../core/services/geocoding.service';
import { LocationEntry } from '../../../core/models/location.model';
import { NearbyZone } from '../../../core/models/nearby-zone.model';
import { FrequentPlace } from '../../../core/models/frequent-place.model';

type SubTab = 'mapa' | 'historial';
type GpsStatus = 'buscando' | 'activo' | 'denegado' | 'no-disponible';

/** Layers the user can turn on/off (remembered in this browser). */
interface Layers {
  routes: boolean;
  onlyImportant: boolean;
  locations: boolean;
  zones: boolean;
}

const LAYERS_KEY = 'alerta_mujer_capas_mapa';
const DEFAULT_LAYERS: Layers = { routes: true, onlyImportant: false, locations: true, zones: true };
// Neiva (Huila): same default center as the mobile app
const DEFAULT_CENTER: L.LatLngTuple = [2.9273, -75.2819];
const ROUTE_COLORS = ['#a78bfa', '#7238f8', '#e372f4', '#782dda'];

// Colors aligned with the mobile app
export const ZONE_STYLE: Record<NearbyZone['type'], { color: string; label: string }> = {
  safe: { color: '#5316a3', label: 'Zona segura' },
  risk: { color: '#cb1ce6', label: 'Zona de riesgo' },
  help: { color: '#500ee9', label: 'Punto de ayuda' },
  asistencia: { color: '#733bf6', label: 'Asistencia' },
  policia: { color: '#9333ea', label: 'Policía' },
};
const PLACE_RISK: Record<string, { color: string; label: string }> = {
  muy_segura: { color: '#5316a3', label: 'Muy segura' },
  moderada: { color: '#a70bf5', label: 'Moderada' },
  muy_insegura: { color: '#cb1ce6', label: 'Muy insegura' },
};

const phoneIcon = L.divIcon({
  className: '',
  html: `<div class="mu-phone-marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

// The address is only requested again if the user moved more than this
const METERS_TO_REGEOCODE = 30;

const youIcon = L.divIcon({
  className: '',
  html: `<div class="mu-you-marker"><span></span></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

@Component({
  selector: 'app-my-location',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-location.html',
  styleUrl: './my-location.scss',
})
export class MyLocationComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  private phoneLocationService = inject(PhoneLocationService);
  private zoneService = inject(ZonesService);
  private frequentPlaceService = inject(FrequentPlaceService);
  private routesService = inject(RoutesService);
  private authService = inject(AuthService);
  private geocoding = inject(GeocodingService);
  private injector = inject(Injector);

  private map: L.Map | null = null;
  private resizeObserver?: ResizeObserver;
  private meLayer = L.layerGroup();
  private phoneLayer = L.layerGroup();
  private lastGeocoded: L.LatLng | null = null;
  private routesLayer = L.layerGroup();
  private locationsLayer = L.layerGroup();
  private zonesLayer = L.layerGroup();
  private watchId: number | null = null;
  private initiallyCentered = false;

  readonly MAX_ROUTES = this.routesService.routeLimit;
  readonly MAX_STARRED = this.routesService.starLimit;
  readonly zoneStyle = ZONE_STYLE;
  readonly placeRisk = PLACE_RISK;

  activeTab = signal<SubTab>('mapa');

  // ── Live location (GPS of this device) ─
  gpsStatus = signal<GpsStatus>('buscando');
  position = signal<{ lat: number; lng: number; precision: number } | null>(null);
  updatedAt = signal<Date | null>(null);
  follow = signal(true);
  place = signal<Place | null>(null);
  searchingPlace = signal(false);

  // ── Phone location (last one the mobile app sent) ─
  phone = signal<LocationEntry | null>(null);
  phonePlace = signal<Place | null>(null);
  loadingPhone = signal(false);
  queriedPhone = signal(false);
  phoneError = signal(false);
  phoneNotice = signal<string | null>(null);

  // ── Datos del mapa ─────────────────────────────
  routes = this.routesService.routes$;
  starredCount = computed(() => this.routes().filter((r) => r.important));
  locations = signal<FrequentPlace[]>([]);
  zones = signal<NearbyZone[]>([]);

  // ── History (locations reported by the phone) ─
  history = signal<LocationEntry[]>([]);
  historyPlaces = signal<Record<number, string>>({});
  loadingHistory = signal(true);
  historyError = signal(false);

  // ── Capas ──────────────────────────────────────
  layers = signal<Layers>(this.readLayers());

  routesOnMap = computed(() => {
    const c = this.layers();
    if (!c.routes) return [];
    return c.onlyImportant ? this.starredCount() : this.routes();
  });

  currentZone = computed(() => {
    const p = this.position();
    if (!p) return null;
    return this.zones().find(
      (z) => z.radiusMeters && L.latLng(p.lat, p.lng).distanceTo([z.lat, z.lng]) <= z.radiusMeters
    ) ?? null;
  });

  ngOnInit(): void {
    this.routesService.load();

    this.zoneService.getNearby().subscribe({
      next: (zones) => this.zones.set(zones),
      error: () => this.zones.set([]),
    });

    this.authService.currentUser$.subscribe((user: any) => {
      if (!user) return;
      this.frequentPlaceService.getByUser(user.id).subscribe({
        next: (places) => this.locations.set(places.filter((l) => l.isActive !== false)),
        error: () => this.locations.set([]),
      });
      this.loadHistory(user.id);
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.startGps();

    effect(() => this.drawMe(), { injector: this.injector });
    effect(() => this.drawRoutes(), { injector: this.injector });
    effect(() => this.drawLocations(), { injector: this.injector });
    effect(() => this.drawZones(), { injector: this.injector });
    effect(() => this.drawPhone(), { injector: this.injector });
  }

  ngOnDestroy(): void {
    if (this.watchId !== null) navigator.geolocation?.clearWatch(this.watchId);
    this.resizeObserver?.disconnect();
    this.map?.remove();
    this.map = null;
  }

  // ── Capas ──────────────────────────────────────
  toggleLayer(layer: keyof Layers): void {
    this.layers.update((c) => {
      const newOne = { ...c, [layer]: !c[layer] };
      // "Solo importantes" depends on the routes being visible
      if (layer === 'routes' && !newOne.routes) newOne.onlyImportant = false;
      return newOne;
    });
    try {
      localStorage.setItem(LAYERS_KEY, JSON.stringify(this.layers()));
    } catch { /* preferencia opcional */ }
  }

  private readLayers(): Layers {
    try {
      return { ...DEFAULT_LAYERS, ...JSON.parse(localStorage.getItem(LAYERS_KEY) ?? '{}') };
    } catch {
      return { ...DEFAULT_LAYERS };
    }
  }

  // ── GPS en vivo ────────────────────────────────
  private startGps(): void {
    if (!('geolocation' in navigator)) {
      this.gpsStatus.set('no-disponible');
      return;
    }
    this.gpsStatus.set('buscando');
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.position.set({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy });
        this.updatedAt.set(new Date(pos.timestamp));
        this.gpsStatus.set('activo');
        this.updatePlace(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => this.gpsStatus.set(err.code === err.PERMISSION_DENIED ? 'denegado' : 'no-disponible'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
  }

  private updatePlace(lat: number, lng: number): void {
    const here = L.latLng(lat, lng);
    if (this.lastGeocoded && this.lastGeocoded.distanceTo(here) < METERS_TO_REGEOCODE) return;
    this.lastGeocoded = here;
    this.searchingPlace.set(true);
    this.geocoding.get(lat, lng).then((place) => {
      this.place.set(place);
      this.searchingPlace.set(false);
    });
  }

  // ── Phone location ──────────────────────
  /**
   * Asks the phone for its current location (silent push) and waits up to 20 s for a new point
   * to arrive. If the phone does not answer (no internet, no background location permission), the
   * last location it sent is shown, with its age.
   */
  viewPhone(): void {
    this.loadingPhone.set(true);
    this.phoneError.set(false);
    this.phoneNotice.set(null);
    this.phoneLocationService.requestFromPhone().subscribe({
      next: (r) => this.waitForResponse(new Date(r.requestedAt).getTime() - 5000, Date.now() + 20000),
      error: (e) => {
        // 409: no phone with notifications or requested too often; the last point is shown anyway
        this.phoneNotice.set(e?.error?.message ?? null);
        this.showLatest();
      },
    });
  }

  private waitForResponse(from: number, limit: number): void {
    this.phoneLocationService.getLatest().subscribe({
      next: (loc) => {
        const newOne = !!loc?.recordedAt && new Date(loc.recordedAt).getTime() >= from;
        if (newOne || Date.now() >= limit) {
          if (!newOne) this.phoneNotice.set('El celular no respondió. Se muestra la última ubicación que envió.');
          this.applyPhone(loc);
          return;
        }
        setTimeout(() => this.waitForResponse(from, limit), 2500);
      },
      error: () => {
        this.loadingPhone.set(false);
        this.phoneError.set(true);
      },
    });
  }

  private showLatest(): void {
    this.phoneLocationService.getLatest().subscribe({
      next: (loc) => this.applyPhone(loc),
      error: () => {
        this.loadingPhone.set(false);
        this.phoneError.set(true);
      },
    });
  }

  private applyPhone(loc: LocationEntry | null): void {
    this.loadingPhone.set(false);
    this.queriedPhone.set(true);
    this.phone.set(loc);
    if (!loc) return;
    this.setTab('mapa');
    this.follow.set(false);
    setTimeout(() => this.map?.flyTo([loc.lat, loc.lng], 17, { duration: 0.9 }), 150);
    this.phonePlace.set(null);
    this.geocoding.get(loc.lat, loc.lng).then((place) => {
      if (this.phone()?.id === loc.id) this.phonePlace.set(place);
    });
  }

  /** "hace 3 min", "hace 2 h"... */
  howLongAgo(iso?: string): string {
    if (!iso) return '';
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'hace un momento';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  }

  placeText(l: Place | null): string {
    return l ? [[l.address, l.city].filter(Boolean).join(', '), l.neighborhood].filter(Boolean).join(' · ') : '';
  }

  retryGps(): void {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.startGps();
  }

  center(): void {
    const p = this.position();
    this.follow.set(true);
    if (p) this.map?.flyTo([p.lat, p.lng], 16, { duration: 0.8 });
  }

  // ── Mapa ───────────────────────────────────────
  private initMap(): void {
    if (!this.mapContainer || this.map) return;
    this.map = L.map(this.mapContainer.nativeElement, { center: DEFAULT_CENTER, zoom: 14 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    // Orden de abajo hacia arriba: zonas, recorridos, ubicaciones, yo
    [this.zonesLayer, this.routesLayer, this.locationsLayer, this.phoneLayer, this.meLayer].forEach((c) => c.addTo(this.map!));

    // If the user moves the map, it stops following her until she presses "Centrar"
    this.map.on('dragstart', () => this.follow.set(false));
    // Recomputes the size when the width changes (sidebar, window, tabs)
    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }

  private drawMe(): void {
    const p = this.position();
    if (!this.map) return;
    this.meLayer.clearLayers();
    if (!p) return;

    L.circle([p.lat, p.lng], {
      radius: p.precision, color: '#8e63f1', weight: 1, fillColor: '#8e63f1', fillOpacity: 0.12,
    }).addTo(this.meLayer);
    L.marker([p.lat, p.lng], { icon: youIcon, zIndexOffset: 1000 })
      .bindTooltip('Estás aquí')
      .addTo(this.meLayer);

    if (!this.initiallyCentered) {
      this.map.setView([p.lat, p.lng], 16);
      this.initiallyCentered = true;
    } else if (this.follow()) {
      this.map.panTo([p.lat, p.lng], { animate: true });
    }
  }

  private drawPhone(): void {
    const loc = this.phone();
    const place = this.phonePlace();
    if (!this.map) return;
    this.phoneLayer.clearLayers();
    if (!loc) return;

    if (loc.accuracy) {
      L.circle([loc.lat, loc.lng], {
        radius: loc.accuracy, color: '#d648ec', weight: 1, fillColor: '#d648ec', fillOpacity: 0.12,
      }).addTo(this.phoneLayer);
    }
    const detail = place ? escapeHtml(this.placeText(place)) : 'Buscando dirección…';
    L.marker([loc.lat, loc.lng], { icon: phoneIcon, zIndexOffset: 900 })
      .bindPopup(`<strong>Tu celular</strong><br>${detail}<br><small>${this.howLongAgo(loc.recordedAt)} · ${loc.time}</small>`)
      .addTo(this.phoneLayer)
      .openPopup();
  }

  private drawRoutes(): void {
    const list = this.routesOnMap();
    const all = this.routes();
    if (!this.map) return;
    this.routesLayer.clearLayers();

    for (const r of list) {
      if (!r.points || r.points.length < 2) continue;
      const latlngs = r.points.map((p) => [p.latitude, p.longitude] as L.LatLngTuple);
      const color = ROUTE_COLORS[Math.max(0, all.findIndex((x) => x.id === r.id)) % ROUTE_COLORS.length];
      const name = escapeHtml(r.customName ?? 'Recorrido');

      L.polyline(latlngs, { color, weight: r.important ? 5 : 4, opacity: 0.95, dashArray: r.important ? undefined : '8 8' })
        .bindTooltip(`${r.important ? '★ ' : ''}${name}`, { sticky: true })
        .addTo(this.routesLayer);
      L.circleMarker(latlngs[0], { radius: 6, color: '#fff', weight: 2, fillColor: '#6922c5', fillOpacity: 1 })
        .bindPopup(`<strong>${name}</strong><br>Inicio: ${escapeHtml(r.startNeighborhood)}`)
        .addTo(this.routesLayer);
      L.circleMarker(latlngs[latlngs.length - 1], { radius: 6, color: '#fff', weight: 2, fillColor: '#c026d3', fillOpacity: 1 })
        .bindPopup(`<strong>${name}</strong><br>Destino: ${escapeHtml(r.endNeighborhood)}`)
        .addTo(this.routesLayer);
    }
  }

  private drawLocations(): void {
    const visible = this.layers().locations;
    const places = this.locations();
    if (!this.map) return;
    this.locationsLayer.clearLayers();
    if (!visible) return;

    for (const l of places) {
      if (!Number.isFinite(l.lat) || !Number.isFinite(l.lng)) continue;
      const risk = PLACE_RISK[l.riskLevel ?? 'moderada'] ?? PLACE_RISK['moderada'];
      L.marker([l.lat, l.lng], { icon: placeIcon(risk.color) })
        .bindPopup(
          `<strong>${escapeHtml(l.name)}</strong><br>${escapeHtml(l.address || l.city || '')}<br>` +
          `<span style="color:${risk.color};font-weight:700">● ${risk.label}</span>`
        )
        .addTo(this.locationsLayer);
    }
  }

  private drawZones(): void {
    const visible = this.layers().zones;
    const zones = this.zones();
    if (!this.map) return;
    this.zonesLayer.clearLayers();
    if (!visible) return;

    for (const z of zones) {
      if (!Number.isFinite(z.lat) || !Number.isFinite(z.lng)) continue;
      const style = ZONE_STYLE[z.type] ?? ZONE_STYLE.risk;
      if (z.radiusMeters) {
        L.circle([z.lat, z.lng], {
          radius: z.radiusMeters, color: style.color, weight: 1.5, fillColor: style.color, fillOpacity: 0.12,
        }).addTo(this.zonesLayer);
      }
      L.marker([z.lat, z.lng], { icon: zoneIcon(z.type, style.color) })
        .bindPopup(`<strong>${escapeHtml(z.name)}</strong><br>${style.label}${z.city ? ' · ' + escapeHtml(z.city) : ''}`)
        .addTo(this.zonesLayer);
    }
  }

  // ── Historial ──────────────────────────────────
  // Address of the most recent records, one by one (respects the Nominatim limit)
  private async geocodeHistory(entries: LocationEntry[]): Promise<void> {
    for (const e of entries) {
      const place = await this.geocoding.get(e.lat, e.lng);
      const text = this.placeText(place);
      if (text) this.historyPlaces.update((m) => ({ ...m, [e.id]: text }));
    }
  }

  private loadHistory(_userId: number): void {
    this.loadingHistory.set(true);
    this.phoneLocationService.getMine(100).subscribe({
      next: (data) => {
        this.history.set(data); // the backend already returns them newest to oldest
        this.loadingHistory.set(false);
        this.geocodeHistory(data.slice(0, 20));
      },
      error: () => {
        this.historyError.set(true);
        this.loadingHistory.set(false);
      },
    });
  }

  setTab(tab: SubTab): void {
    this.activeTab.set(tab);
    if (tab === 'mapa') setTimeout(() => this.map?.invalidateSize(), 100);
  }

  flyTo(loc: LocationEntry): void {
    this.follow.set(false);
    this.setTab('mapa');
    setTimeout(() => this.map?.flyTo([loc.lat, loc.lng], 17, { duration: 1 }), 150);
  }

  updateTime(): string {
    const d = this.updatedAt();
    return d ? d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
  }
}

function placeIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="mu-place-pin" style="--pin:${color}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
