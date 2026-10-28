import { TPipe } from '../../../core/i18n/i18n';
import {
  AfterViewInit, Component, ElementRef, Injector, OnDestroy, OnInit, ViewChild,
  computed, effect, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, catchError } from 'rxjs';
import * as L from 'leaflet';
import { zoneIcon } from '../../../core/utils/zone-icon';
import { ZonesService } from '../../../core/services/zones.service';
import { ResourcesService } from '../../../core/services/resources.service';
import { NearbyZone } from '../../../core/models/nearby-zone.model';
import { EmergencyResourceApi } from '../../../core/models/resource.model';

type Category = 'riesgo' | 'segura' | 'policia' | 'salud' | 'apoyo' | 'linea';

/** Emergency zone or resource, unified for the list and the map. */
interface Point {
  key: string;
  source: 'zona' | 'recurso';
  name: string;
  category: Category;
  description?: string;
  address?: string;
  city?: string;
  lat?: number;
  lng?: number;
  radio?: number;
  telephone?: string;
  telephone2?: string;
}

// Colors aligned with "Mi ubicación" and the mobile app
export const CATEGORIES: Record<Category, { label: string; color: string }> = {
  riesgo: { label: 'Zona de riesgo', color: '#cb1ce6' },
  segura: { label: 'Zona segura', color: '#5316a3' },
  policia: { label: 'Policía', color: '#9333ea' },
  salud: { label: 'Salud', color: '#733bf6' },
  apoyo: { label: 'Apoyo a la mujer', color: '#d648ec' },
  linea: { label: 'Línea de ayuda', color: '#a70bf5' },
};

const DEFAULT_CENTER: L.LatLngTuple = [2.9273, -75.2819];

function zoneCategory(type: NearbyZone['type']): Category {
  switch (type) {
    case 'safe': return 'segura';
    case 'policia': return 'policia';
    case 'asistencia':
    case 'help': return 'apoyo';
    default: return 'riesgo';
  }
}

function resourceCategory(type: string): Category {
  switch (type) {
    case 'police_station':
    case 'police_post': return 'policia';
    case 'hospital':
    case 'health_center':
    case 'ambulance': return 'salud';
    case 'emergency_line': return 'linea';
    default: return 'apoyo'; // support_organization, fire_station
  }
}

@Component({
  selector: 'app-help-zones',
  standalone: true,
  imports: [TPipe, CommonModule, FormsModule],
  templateUrl: './help-zones.html',
  styleUrl: './help-zones.scss',
})
export class HelpZonesComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  private zoneService = inject(ZonesService);
  private resourcesService = inject(ResourcesService);
  private injector = inject(Injector);

  private map: L.Map | null = null;
  private resizeObserver?: ResizeObserver;
  private pointsLayer = L.layerGroup();
  private meLayer = L.layerGroup();
  private markers = new Map<string, L.Layer>();
  private fittedView = false;

  readonly categories = CATEGORIES;
  readonly categoryList = Object.keys(CATEGORIES) as Category[];

  points = signal<Point[]>([]);
  loading = signal(true);
  error = signal('');

  search = signal('');
  filter = signal<Category | null>(null);
  selected = signal<string | null>(null);

  myPosition = signal<{ lat: number; lng: number } | null>(null);
  locationStatus = signal<'sin-pedir' | 'buscando' | 'ok' | 'denegada'>('sin-pedir');

  /** Lines to call without searching (always shown on top). */
  lines = computed(() => this.points().filter((p) => p.category === 'linea' && p.telephone));

  count = computed(() => {
    const c = Object.fromEntries(this.categoryList.map((k) => [k, 0])) as Record<Category, number>;
    for (const p of this.points()) c[p.category]++;
    return c;
  });

  /** List filtered and sorted by proximity (if the location is known). */
  filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const filter = this.filter();
    const list = this.points().filter((p) => {
      if (filter && p.category !== filter) return false;
      if (!term) return true;
      return [p.name, p.address, p.city, p.description, CATEGORIES[p.category].label]
        .some((t) => (t ?? '').toLowerCase().includes(term));
    });
    if (!this.myPosition()) return list;
    return [...list].sort((a, b) => (this.distance(a) ?? Infinity) - (this.distance(b) ?? Infinity));
  });

  /** Risk / safe zones the user is in right now. */
  currentZones = computed(() =>
    this.points().filter((p) => p.radio && (this.distance(p) ?? Infinity) <= p.radio)
  );

  ngOnInit(): void {
    forkJoin({
      zones: this.zoneService.getNearby().pipe(catchError(() => of(null))),
      resources: this.resourcesService.getActiveResources().pipe(catchError(() => of(null))),
    }).subscribe(({ zones, resources }) => {
      if (!zones && !resources) this.error.set('No se pudieron cargar las zonas. Intenta de nuevo.');
      this.points.set([...(zones ?? []).map(fromZone), ...(resources ?? []).map(fromResource)]);
      this.loading.set(false);
    });

    // If she already gave location permission before, it is used without asking again
    navigator.permissions?.query({ name: 'geolocation' as PermissionName })
      .then((p) => { if (p.state === 'granted') this.useMyLocation(); })
      .catch(() => {});
  }

  ngAfterViewInit(): void {
    this.initMap();
    effect(() => this.drawPoints(), { injector: this.injector });
    effect(() => this.drawMe(), { injector: this.injector });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
    this.map = null;
  }

  // ── User location ────────────────────
  useMyLocation(): void {
    if (!navigator.geolocation) {
      this.locationStatus.set('denegada');
      return;
    }
    this.locationStatus.set('buscando');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.myPosition.set({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        this.locationStatus.set('ok');
      },
      () => this.locationStatus.set('denegada'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  distance(p: Point): number | null {
    const yo = this.myPosition();
    if (!yo || p.lat == null || p.lng == null) return null;
    return L.latLng(yo.lat, yo.lng).distanceTo([p.lat, p.lng]);
  }

  distanceFormat(p: Point): string {
    const d = this.distance(p);
    if (d == null) return '';
    return d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(d < 10000 ? 1 : 0)} km`;
  }

  // ── Mapa ───────────────────────────────────────
  private initMap(): void {
    if (!this.mapContainer || this.map) return;
    this.map = L.map(this.mapContainer.nativeElement, { center: DEFAULT_CENTER, zoom: 13 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);
    this.pointsLayer.addTo(this.map);
    this.meLayer.addTo(this.map);

    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }

  private drawPoints(): void {
    const list = this.filtered();
    const selected = this.selected();
    if (!this.map) return;

    this.pointsLayer.clearLayers();
    this.markers.clear();
    const bounds = L.latLngBounds([]);

    for (const p of list) {
      if (p.lat == null || p.lng == null) continue;
      const { color } = CATEGORIES[p.category];
      const active = p.key === selected;

      if (p.radio) {
        L.circle([p.lat, p.lng], {
          radius: p.radio, color, weight: active ? 3 : 1.5, fillColor: color, fillOpacity: active ? 0.22 : 0.12,
        }).on('click', () => this.selected.set(p.key)).addTo(this.pointsLayer);
      }
      const marker = L.marker([p.lat, p.lng], { icon: pointIcon(p.category, active), zIndexOffset: active ? 500 : 0 })
        .bindPopup(pointPopup(p, this.distanceFormat(p)))
        .on('click', () => this.selected.set(p.key))
        .addTo(this.pointsLayer);
      this.markers.set(p.key, marker);
      bounds.extend([p.lat, p.lng]);
    }

    if (!this.fittedView && bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
      this.fittedView = true;
    }
  }

  private drawMe(): void {
    const yo = this.myPosition();
    if (!this.map) return;
    this.meLayer.clearLayers();
    if (!yo) return;
    L.marker([yo.lat, yo.lng], {
      icon: L.divIcon({ className: '', html: '<div class="za-you"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
      zIndexOffset: 1000,
    }).bindTooltip('Estás aquí').addTo(this.meLayer);
  }

  viewOnMap(p: Point): void {
    this.selected.set(p.key);
    if (p.lat == null || p.lng == null || !this.map) return;
    this.map.flyTo([p.lat, p.lng], p.radio && p.radio > 300 ? 15 : 16, { duration: 0.8 });
    setTimeout(() => (this.markers.get(p.key) as L.Marker | undefined)?.openPopup(), 850);
  }

  centerOnMe(): void {
    const yo = this.myPosition();
    if (yo) this.map?.flyTo([yo.lat, yo.lng], 15, { duration: 0.8 });
  }
}

function fromZone(z: NearbyZone): Point {
  return {
    key: `z${z.id}`,
    source: 'zona',
    name: z.name,
    category: zoneCategory(z.type),
    description: z.description,
    address: z.address,
    city: z.city,
    lat: z.lat,
    lng: z.lng,
    radio: z.radiusMeters,
  };
}

function fromResource(r: EmergencyResourceApi): Point {
  return {
    key: `r${r.id}`,
    source: 'recurso',
    name: r.name,
    category: resourceCategory(r.resourceType),
    description: r.description ?? undefined,
    address: r.address ?? undefined,
    city: r.city,
    lat: r.latitude ?? undefined,
    lng: r.longitude ?? undefined,
    telephone: r.telephone ?? undefined,
    telephone2: r.secondaryTelephone ?? undefined,
  };
}

const ICONS: Record<Category, string> = {
  riesgo: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  segura: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  policia: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  salud: '<path d="M12 5v14M5 12h14"/>',
  apoyo: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  linea: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
};

export function svgIcon(c: Category): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[c]}</svg>`;
}

function pointIcon(c: Category, active: boolean): L.DivIcon {
  return zoneIcon(c, CATEGORIES[c].color, active);
}

function pointPopup(p: Point, distance: string): string {
  const { label, color } = CATEGORIES[p.category];
  const place = [p.address, p.city].filter(Boolean).join(', ');
  return `
    <div class="za-popup">
      <div class="za-popup-type" style="color:${color}">● ${label}</div>
      <div class="za-popup-name">${escapeHtml(p.name)}</div>
      ${place ? `<div class="za-popup-row">${escapeHtml(place)}</div>` : ''}
      ${p.description ? `<div class="za-popup-row">${escapeHtml(p.description)}</div>` : ''}
      ${distance ? `<div class="za-popup-row"><strong>A ${distance} de ti</strong></div>` : ''}
      ${p.telephone ? `<div class="za-popup-row">Tel. ${escapeHtml(p.telephone)}</div>` : ''}
    </div>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
