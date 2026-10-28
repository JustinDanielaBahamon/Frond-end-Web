import { TPipe } from '../../../core/i18n/i18n';
import {
  AfterViewInit, Component, ElementRef, Injector, OnDestroy, OnInit, ViewChild,
  computed, effect, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { AssistanceService } from '../../../core/services/assistance.service';
import { ZonesService } from '../../../core/services/zones.service';
import { PhoneLocationService } from '../../../core/services/phone.location.services';
import { NearbyZone } from '../../../core/models/nearby-zone.model';
import { zoneIcon } from '../../../core/utils/zone-icon';
import { ResourceCategory, RecordedCall, HelpResource } from '../../../core/models/assistance.model';

type Tab = 'lineas' | 'centros' | 'llamadas';

export const CATEGORIES: Record<ResourceCategory, { label: string; color: string }> = {
  linea: { label: 'Línea de ayuda', color: '#8b5cf6' },
  policia: { label: 'Policía', color: '#7c3aed' },
  salud: { label: 'Salud', color: '#5b21b6' },
  apoyo: { label: 'Apoyo a la mujer', color: '#6d28d9' },
  bomberos: { label: 'Bomberos', color: '#c026d3' },
};

const STATUSES: Record<string, string> = {
  initiated: 'Iniciada', completed: 'Completada', failed: 'Fallida', missed: 'Sin respuesta',
};

const EMERGENCY_NUMBER = '123';
const DEFAULT_CENTER: L.LatLngTuple = [2.9273, -75.2819];

@Component({
  selector: 'app-assistance',
  standalone: true,
  imports: [TPipe, CommonModule, FormsModule],
  templateUrl: './assistance.html',
  styleUrl: './assistance.scss',
})
export class Assistance implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;

  private service = inject(AssistanceService);
  private zonesService = inject(ZonesService);
  private phoneLocation = inject(PhoneLocationService);
  private injector = inject(Injector);

  private map: L.Map | null = null;
  private resizeObserver?: ResizeObserver;
  private layer = L.layerGroup();
  private markers = new Map<number, L.Marker>();
  private fittedView = false;

  readonly categories = CATEGORIES;
  readonly categoryList = Object.keys(CATEGORIES) as ResourceCategory[];
  readonly emergencyNumber = EMERGENCY_NUMBER;

  tab = signal<Tab>('lineas');
  resources = signal<HelpResource[]>([]);
  /** Help zones of the home map (police, assistance centers, help points). */
  helpZones = signal<HelpResource[]>([]);
  /** Everything that can be shown on the centers map. */
  private points = computed(() => [...this.resources(), ...this.helpZones()]);
  calls = signal<RecordedCall[]>([]);
  loading = signal(true);
  error = signal('');
  notice = signal('');

  search = signal('');
  filter = signal<ResourceCategory | null>(null);
  selected = signal<number | null>(null);
  myPosition = signal<{ lat: number; lng: number } | null>(null);

  /** Resources that can be called. */
  lines = computed(() => this.resources().filter((r) => r.telephone));

  /** Resources with location, filtered and sorted by proximity when known. */
  centers = computed(() => {
    const term = this.search().trim().toLowerCase();
    const filter = this.filter();
    const list = this.points().filter((r) => {
      if (r.lat == null || r.lng == null) return false;
      if (filter && r.category !== filter) return false;
      if (!term) return true;
      return [r.name, r.description, r.address, r.city, CATEGORIES[r.category].label]
        .some((t) => (t ?? '').toLowerCase().includes(term));
    });
    if (!this.myPosition()) return list;
    return [...list].sort((a, b) => (this.distance(a) ?? Infinity) - (this.distance(b) ?? Infinity));
  });

  centerCount = computed(() => {
    const c = Object.fromEntries(this.categoryList.map((k) => [k, 0])) as Record<ResourceCategory, number>;
    for (const r of this.points()) if (r.lat != null && r.lng != null) c[r.category]++;
    return c;
  });

  totalCenters = computed(() => this.points().filter((r) => r.lat != null && r.lng != null).length);

  ngOnInit(): void {
    this.service.getResources().subscribe({
      next: (list) => {
        this.resources.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los recursos de ayuda. Intenta de nuevo.');
        this.loading.set(false);
      },
    });
    this.zonesService.getNearby().subscribe({
      next: (zones) => this.helpZones.set(zones.map(fromZone).filter((z): z is HelpResource => z !== null)),
      error: () => {},
    });
    this.loadCalls();
    // The distance is measured from the phone (the location the app sends), not from the computer
    this.useMyLocation(false);
  }

  ngAfterViewInit(): void {
    effect(() => this.draw(), { injector: this.injector });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
    this.map = null;
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'centros') setTimeout(() => this.initMap(), 0);
  }

  // ── Llamadas ───────────────────────────────────
  private loadCalls(): void {
    this.service.getMyCalls().subscribe({ next: (l) => this.calls.set(l), error: () => {} });
  }

  copy(number: string): void {
    navigator.clipboard?.writeText(number).then(() => this.showNotice(`Número ${number} copiado.`));
  }

  deleteCall(l: RecordedCall): void {
    this.service.deleteCall(l.id).subscribe({
      next: () => this.calls.update((list) => list.filter((x) => x.id !== l.id)),
      error: () => this.showNotice('No se pudo borrar el registro.'),
    });
  }

  resourceOf(l: RecordedCall): HelpResource | undefined {
    return this.resources().find((r) => r.id === l.resourceId);
  }

  // ── Centros y mapa ─────────────────────────────
  useMyLocation(notify = true): void {
    this.phoneLocation.getLatest().subscribe({
      next: (u) => {
        if (u) {
          this.myPosition.set({ lat: u.lat, lng: u.lng });
          this.fittedView = false;
        } else if (notify) {
          this.showNotice('Tu celular aún no ha enviado su ubicación. Abre AlertaMujer en el celular para ver distancias.');
        }
      },
      error: () => { if (notify) this.showNotice('No pudimos obtener la ubicación de tu celular.'); },
    });
  }

  distance(r: HelpResource): number | null {
    const yo = this.myPosition();
    if (!yo || r.lat == null || r.lng == null) return null;
    return L.latLng(yo.lat, yo.lng).distanceTo([r.lat, r.lng]);
  }

  distanceFormat(r: HelpResource): string {
    const d = this.distance(r);
    if (d == null) return '';
    return d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(d < 10000 ? 1 : 0)} km`;
  }

  directions(r: HelpResource): string {
    const yo = this.myPosition();
    return `https://www.openstreetmap.org/directions?route=${yo ? `${yo.lat},${yo.lng}` : ''};${r.lat},${r.lng}`;
  }

  viewOnMap(r: HelpResource): void {
    this.selected.set(r.id);
    if (r.lat == null || r.lng == null) return;
    this.map?.flyTo([r.lat, r.lng], 16, { duration: 0.8 });
    setTimeout(() => this.markers.get(r.id)?.openPopup(), 850);
  }

  private initMap(): void {
    if (this.map || !this.mapContainer) return;
    this.map = L.map(this.mapContainer.nativeElement, { center: DEFAULT_CENTER, zoom: 13 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);
    this.layer.addTo(this.map);
    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapContainer.nativeElement);
    this.draw();
  }

  private draw(): void {
    const list = this.centers();
    const selected = this.selected();
    const yo = this.myPosition();
    if (!this.map) return;

    this.layer.clearLayers();
    this.markers.clear();
    const bounds = L.latLngBounds([]);

    for (const r of list) {
      const { color, label } = CATEGORIES[r.category];
      const active = r.id === selected;
      const marker = L.marker([r.lat!, r.lng!], {
        icon: zoneIcon(r.category, color, active),
        zIndexOffset: active ? 500 : 0,
      })
        .bindPopup(`<strong>${escapeHtml(r.name)}</strong><br><span style="color:${color};font-weight:700">${label}</span>`
          + (r.address ? `<br>${escapeHtml(r.address)}` : '') + `<br>${escapeHtml(r.city)}`)
        .on('click', () => this.selected.set(r.id))
        .addTo(this.layer);
      this.markers.set(r.id, marker);
    }
    // With the phone location the nearest ones are framed (the list already comes sorted);
    // sin ella, todos
    for (const r of yo ? list.slice(0, 8) : list) bounds.extend([r.lat!, r.lng!]);
    if (yo) bounds.extend([yo.lat, yo.lng]);

    if (yo) {
      L.marker([yo.lat, yo.lng], {
        icon: L.divIcon({ className: '', html: '<div class="as-you"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }),
        zIndexOffset: 1000,
      }).bindTooltip('Estás aquí').addTo(this.layer);
    }

    if (!this.fittedView && bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      this.fittedView = true;
    }
  }

  // ── Formato ────────────────────────────────────
  status(e: string): string {
    return STATUSES[e] ?? e;
  }

  date(d: Date): string {
    return d.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  }

  private showNotice(text: string): void {
    this.notice.set(text);
    setTimeout(() => {
      if (this.notice() === text) this.notice.set('');
    }, 3500);
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// Help zones as centers (negative ids so they do not clash with the resources)
const ZONE_CATEGORY: Partial<Record<NearbyZone['type'], ResourceCategory>> = {
  policia: 'policia', asistencia: 'salud', help: 'apoyo',
};

function fromZone(z: NearbyZone): HelpResource | null {
  const category = ZONE_CATEGORY[z.type];
  if (!category) return null; // risk and safe zones are not care centers
  return {
    id: -z.id,
    name: z.name,
    category,
    description: z.description ?? '',
    telephone: null,
    telephone2: null,
    email: null,
    address: z.address ?? null,
    city: z.city ?? '',
    lat: z.lat,
    lng: z.lng,
  };
}
