import { TPipe } from '../../../core/i18n/i18n';
import {
  AfterViewInit, Component, ElementRef, Injector, OnDestroy, OnInit, ViewChild,
  computed, effect, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { FrequentPlaceService } from '../../../core/services/frequent-places.service';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FrequentPlace } from '../../../core/models/frequent-place.model';

type RiskLevel = 'muy_segura' | 'moderada' | 'muy_insegura';

// Neiva (Huila): same default center as the mobile app
const DEFAULT_CENTER: L.LatLngTuple = [2.9273, -75.2819];

// Same levels and colors as the mobile app
export const LEVELS: Record<RiskLevel, { label: string; color: string }> = {
  muy_segura: { label: 'Muy segura', color: '#5316a3' },
  moderada: { label: 'Moderada', color: '#a70bf5' },
  muy_insegura: { label: 'Muy insegura', color: '#cb1ce6' },
};

const QUICK_NAMES = ['Casa', 'Trabajo', 'Universidad', 'Colegio', 'Gimnasio'];

@Component({
  selector: 'app-saved-locations',
  standalone: true,
  imports: [TPipe, CommonModule, FormsModule],
  templateUrl: './saved-locations.html',
  styleUrl: './saved-locations.scss',
})
export class SavedLocationsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  private frequentPlaceService = inject(FrequentPlaceService);
  private geocoding = inject(GeocodingService);
  private authService = inject(AuthService);
  private injector = inject(Injector);

  private map: L.Map | null = null;
  private resizeObserver?: ResizeObserver;
  private placesLayer = L.layerGroup();
  private pointLayer = L.layerGroup();
  private markers = new Map<number, L.Marker>();
  private fittedView = false;

  readonly levels = LEVELS;
  readonly levelList = Object.keys(LEVELS) as RiskLevel[];
  readonly quickNames = QUICK_NAMES;

  // ── Datos ──────────────────────────────────────
  locations = signal<FrequentPlace[]>([]);
  loading = signal(true);
  error = signal('');
  notice = signal('');

  // ── Filtros ────────────────────────────────────
  search = signal('');
  riskFilter = signal<RiskLevel | null>(null);

  count = computed(() => {
    const c: Record<RiskLevel, number> = { muy_segura: 0, moderada: 0, muy_insegura: 0 };
    for (const u of this.locations()) c[this.levelOf(u)]++;
    return c;
  });

  filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const level = this.riskFilter();
    return this.locations().filter((u) => {
      if (level && this.levelOf(u) !== level) return false;
      if (!term) return true;
      return [u.name, u.address, u.city, u.notes].some((t) => (t ?? '').toLowerCase().includes(term));
    });
  });

  selected = signal<number | null>(null);

  // ── Formulario (crear / editar) ────────────────
  formVisible = signal(false);
  editingId = signal<number | null>(null);
  choosingPoint = signal(false);
  point = signal<{ lat: number; lng: number } | null>(null);
  name = signal('');
  address = signal('');
  city = signal('');
  notes = signal('');
  level = signal<RiskLevel>('moderada');
  searchingAddress = signal(false);
  saving = signal(false);
  errorForm = signal('');

  formValid = computed(() => !!this.point() && this.name().trim().length > 0);

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((user: any) => {
      if (!user) {
        this.error.set('Debes iniciar sesión para ver tus ubicaciones.');
        this.loading.set(false);
        return;
      }
      this.load(user.id);
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
    effect(() => this.drawPlaces(), { injector: this.injector });
    effect(() => this.drawPoint(), { injector: this.injector });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
    this.map = null;
  }

  private load(userId: number): void {
    this.loading.set(true);
    this.error.set('');
    this.frequentPlaceService.getByUser(userId).subscribe({
      next: (list) => {
        this.locations.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar tus ubicaciones. Intenta de nuevo.');
        this.loading.set(false);
      },
    });
  }

  levelOf(u: FrequentPlace): RiskLevel {
    return (u.riskLevel && u.riskLevel in LEVELS ? u.riskLevel : 'moderada') as RiskLevel;
  }

  // ── Mapa ───────────────────────────────────────
  private initMap(): void {
    if (!this.mapContainer || this.map) return;
    this.map = L.map(this.mapContainer.nativeElement, { center: DEFAULT_CENTER, zoom: 13 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);
    this.placesLayer.addTo(this.map);
    this.pointLayer.addTo(this.map);

    // Click on the map: chooses the point of a new location (or the new point of the one being edited)
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (!this.formVisible()) this.newOne();
      else if (this.editingId() && !this.choosingPoint()) return;
      this.setPoint(e.latlng.lat, e.latlng.lng);
    });

    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }

  private drawPlaces(): void {
    const list = this.filtered();
    const selected = this.selected();
    const editing = this.editingId();
    if (!this.map) return;

    this.placesLayer.clearLayers();
    this.markers.clear();
    const bounds = L.latLngBounds([]);

    for (const u of list) {
      if (!Number.isFinite(u.lat) || !Number.isFinite(u.lng) || u.id === editing) continue;
      const level = LEVELS[this.levelOf(u)];
      const marker = L.marker([u.lat, u.lng], {
        icon: placeIcon(level.color, u.id === selected),
        zIndexOffset: u.id === selected ? 500 : 0,
      })
        .bindPopup(placePopup(u, level))
        .on('click', () => this.selected.set(u.id))
        .addTo(this.placesLayer);
      this.markers.set(u.id, marker);
      bounds.extend([u.lat, u.lng]);
    }

    if (!this.fittedView && bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
      this.fittedView = true;
    }
  }

  private drawPoint(): void {
    const p = this.point();
    const visible = this.formVisible();
    if (!this.map) return;
    this.pointLayer.clearLayers();
    if (!p || !visible) return;
    L.marker([p.lat, p.lng], { icon: newIcon(LEVELS[this.level()].color), zIndexOffset: 1000 })
      .addTo(this.pointLayer);
  }

  viewOnMap(u: FrequentPlace): void {
    this.selected.set(u.id);
    this.map?.flyTo([u.lat, u.lng], 16, { duration: 0.8 });
    setTimeout(() => this.markers.get(u.id)?.openPopup(), 850);
  }

  // ── Formulario ─────────────────────────────────
  newOne(): void {
    this.resetForm();
    this.formVisible.set(true);
    this.choosingPoint.set(true);
  }

  edit(u: FrequentPlace): void {
    this.resetForm();
    this.editingId.set(u.id);
    this.point.set({ lat: u.lat, lng: u.lng });
    this.name.set(u.name);
    this.address.set(u.address ?? '');
    this.city.set(u.city ?? '');
    this.notes.set(u.notes ?? '');
    this.level.set(this.levelOf(u));
    this.formVisible.set(true);
    this.map?.flyTo([u.lat, u.lng], 16, { duration: 0.8 });
  }

  cancel(): void {
    this.formVisible.set(false);
    this.resetForm();
  }

  changePoint(): void {
    this.choosingPoint.set(true);
  }

  useMyLocation(): void {
    if (!navigator.geolocation) {
      this.errorForm.set('Tu navegador no permite obtener la ubicación.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!this.formVisible()) this.newOne();
        this.setPoint(pos.coords.latitude, pos.coords.longitude);
        this.map?.flyTo([pos.coords.latitude, pos.coords.longitude], 16, { duration: 0.8 });
      },
      () => this.errorForm.set('No se pudo obtener tu ubicación. Revisa los permisos del navegador.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  private setPoint(lat: number, lng: number): void {
    this.point.set({ lat, lng });
    this.choosingPoint.set(false);
    this.errorForm.set('');

    // Automatic address and city (the user can correct them)
    this.searchingAddress.set(true);
    this.geocoding.get(lat, lng).then((place) => {
      if (!this.point() || this.point()!.lat !== lat || this.point()!.lng !== lng) return;
      this.searchingAddress.set(false);
      if (!place) return;
      this.address.set([place.address, place.neighborhood].filter(Boolean).join(' · '));
      if (place.city) this.city.set(place.city);
    });
  }

  save(): void {
    const p = this.point();
    if (!p || !this.name().trim()) {
      this.errorForm.set(!p ? 'Elige el punto en el mapa o usa tu ubicación actual.' : 'Ponle un nombre a la ubicación.');
      return;
    }
    this.saving.set(true);
    this.errorForm.set('');

    const data: Partial<FrequentPlace> = {
      name: this.name().trim(),
      address: this.address().trim(),
      city: this.city().trim(),
      notes: this.notes().trim(),
      riskLevel: this.level(),
      lat: p.lat,
      lng: p.lng,
    };
    const id = this.editingId();
    const request = id
      ? this.frequentPlaceService.update(id, data)
      : this.frequentPlaceService.create({ ...data, isActive: true } as Omit<FrequentPlace, 'id'>);

    request.subscribe({
      next: (place) => {
        this.saving.set(false);
        this.locations.update((prev) => (id ? prev.map((u) => (u.id === id ? place : u)) : [place, ...prev]));
        this.selected.set(place.id);
        this.showNotice(id ? 'Ubicación actualizada.' : 'Ubicación guardada. También aparece en la app móvil.');
        this.cancel();
      },
      error: (err) => {
        this.saving.set(false);
        this.errorForm.set(err?.status === 400 ? 'Revisa los datos e intenta de nuevo.' : 'No se pudo guardar la ubicación.');
      },
    });
  }

  delete(u: FrequentPlace): void {
    if (!confirm(`¿Eliminar "${u.name}"? También se borrará de la app móvil.`)) return;
    this.frequentPlaceService.delete(u.id).subscribe({
      next: () => {
        this.locations.update((prev) => prev.filter((x) => x.id !== u.id));
        if (this.editingId() === u.id) this.cancel();
        this.showNotice('Ubicación eliminada.');
      },
      error: () => this.showNotice('No se pudo eliminar la ubicación.'),
    });
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.choosingPoint.set(false);
    this.point.set(null);
    this.name.set('');
    this.address.set('');
    this.city.set('');
    this.notes.set('');
    this.level.set('moderada');
    this.searchingAddress.set(false);
    this.errorForm.set('');
  }

  private showNotice(text: string): void {
    this.notice.set(text);
    setTimeout(() => {
      if (this.notice() === text) this.notice.set('');
    }, 3500);
  }
}

function placeIcon(color: string, active: boolean): L.DivIcon {
  const size = active ? 30 : 24;
  return L.divIcon({
    className: '',
    html: `<div class="ug-pin${active ? ' ug-pin--active' : ''}" style="--pin:${color}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

function newIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="ug-pin ug-pin--new" style="--pin:${color}"></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
}

function placePopup(u: FrequentPlace, level: { label: string; color: string }): string {
  const row = (t?: string) => (t ? `<div class="ug-popup-row">${escapeHtml(t)}</div>` : '');
  return `
    <div class="ug-popup">
      <div class="ug-popup-name">${escapeHtml(u.name)}</div>
      ${row(u.address)}${row(u.city)}
      ${u.notes ? `<div class="ug-popup-notes">${escapeHtml(u.notes)}</div>` : ''}
      <div class="ug-popup-badge" style="color:${level.color}">● ${level.label}</div>
    </div>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
