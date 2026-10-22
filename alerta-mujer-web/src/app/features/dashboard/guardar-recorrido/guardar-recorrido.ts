import {
  AfterViewInit, Component, ElementRef, Injector, OnDestroy, OnInit, ViewChild,
  WritableSignal, computed, effect, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { RoutesService, SavedRoute } from '../../../core/services/recorridos.service';
import { FrequentPlaceService } from '../../../core/services/frequent-places.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FrequentPlace } from '../../../core/models/frequent-place.model';

type SelectedPoint = {
  latitude: number;
  longitude: number;
  nombre?: string;
};

type SelectionMethod = 'mapa' | 'ubicaciones';
type SubTab = 'recorridos' | 'historial';
type VisibilityFilter = 'todos' | 'estrellas' | 'ocultar';

// Neiva (Huila): mismo centro por defecto que la app móvil
const DEFAULT_CENTER: L.LatLngTuple = [2.9273, -75.2819];
// Velocidad a pie usada por el móvil para estimar el tiempo
const SPEED_KMH = 5;
// Un color por recorrido (máximo 4)
const COLORS = ['#a78bfa', '#7238f8', '#e372f4', '#782dda'];

@Component({
  selector: 'app-guardar-recorrido',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './guardar-recorrido.html',
  styleUrl: './guardar-recorrido.scss',
})
export class SaveRouteComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  private routesService = inject(RoutesService);
  private frequentPlaceService = inject(FrequentPlaceService);
  private authService = inject(AuthService);
  private injector = inject(Injector);

  private map: L.Map | null = null;
  private resizeObserver?: ResizeObserver;
  private routesLayer = L.layerGroup();
  private selectionLayer = L.layerGroup();
  private placesLayer = L.layerGroup();
  private fittedView = false;

  readonly MAX_ROUTES = this.routesService.routeLimit;
  readonly MAX_STARRED = this.routesService.starLimit;

  // ── Estado general ─────────────────────────────
  activeTab = signal<SubTab>('recorridos');
  loading = this.routesService.loading;
  saving = signal(false);
  error = signal('');
  notice = signal('');
  success = signal('');

  routes = this.routesService.routes$;
  starredCount = computed(() => this.routes().filter((r) => r.important));
  limitReached = computed(() => this.routes().length >= this.MAX_ROUTES);

  visibilityFilter = signal<VisibilityFilter>('todos');
  routesOnMap = computed(() => {
    switch (this.visibilityFilter()) {
      case 'ocultar': return [];
      case 'estrellas': return this.starredCount();
      default: return this.routes();
    }
  });

  selected = signal<SavedRoute | null>(null);
  detail = signal<SavedRoute | null>(null);

  // ── Formulario de nuevo recorrido ──────────────
  readonly formPoints = ['A', 'B'] as const;
  selectionMethod = signal<SelectionMethod>('mapa');
  selectingPoint = signal<'A' | 'B' | null>(null);
  pointA = signal<SelectedPoint | null>(null);
  pointB = signal<SelectedPoint | null>(null);
  pointAName = signal('');
  pointBName = signal('');
  routeName = signal('');
  savedLocations = signal<FrequentPlace[]>([]);

  distanceKm = computed(() => {
    const a = this.pointA();
    const b = this.pointB();
    return a && b ? haversineKm(a, b) : null;
  });

  estimatedMinutes = computed(() => {
    const km = this.distanceKm();
    return km == null ? null : Math.round((km / SPEED_KMH) * 60);
  });

  canSave = computed(
    () => !!this.pointA() && !!this.pointB() && !this.limitReached() && !this.saving()
  );

  ngOnInit(): void {
    this.routesService.load().then((r) => {
      if (!r.ok) this.error.set(r.error ?? '');
    });

    this.authService.currentUser$.subscribe((user: any) => {
      if (!user) return;
      this.frequentPlaceService.getByUser(user.id).subscribe({
        next: (places) => this.savedLocations.set(places),
        error: () => this.savedLocations.set([]),
      });
    });
  }

  ngAfterViewInit(): void {
    this.initMap();

    // Redibuja el mapa cuando cambian los recorridos, el filtro, la selección o los lugares
    effect(() => this.drawRoutes(), { injector: this.injector });
    effect(() => this.drawSelection(), { injector: this.injector });
    effect(() => this.drawPlaces(), { injector: this.injector });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
    this.map = null;
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
    this.routesLayer.addTo(this.map);
    this.selectionLayer.addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const point = this.selectingPoint();
      if (!point) return;
      this.setPoint(point, { latitude: e.latlng.lat, longitude: e.latlng.lng });
    });

    // El contenedor puede cambiar de tamaño al montar la vista
    // Recalcula el tamaño cuando cambia el ancho (sidebar, ventana, pestañas)
    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }

  private drawRoutes(): void {
    const list = this.routesOnMap();
    const selected = this.selected();
    const all = this.routes();
    if (!this.map) return;

    this.routesLayer.clearLayers();
    const bounds = L.latLngBounds([]);

    for (const r of list) {
      if (!r.puntos || r.puntos.length < 2) continue;
      const latlngs = r.puntos.map((p) => [p.latitude, p.longitude] as L.LatLngTuple);
      const color = this.colorDe(r, all);
      const active = selected?.id === r.id;

      L.polyline(latlngs, {
        color,
        weight: active ? 7 : r.important ? 5 : 4,
        opacity: selected && !active ? 0.45 : 0.95,
        dashArray: r.important ? undefined : '8 8',
      })
        .bindTooltip(`${r.important ? '★ ' : ''}${escapeHtml(r.customName ?? 'Recorrido')}`, { sticky: true })
        .on('click', () => this.focus(r))
        .addTo(this.routesLayer);

      L.marker(latlngs[0], { icon: pointIcon('A', color) })
        .bindPopup(`<strong>${escapeHtml(r.customName ?? 'Recorrido')}</strong><br>Inicio: ${escapeHtml(r.startNeighborhood)}`)
        .addTo(this.routesLayer);
      L.marker(latlngs[latlngs.length - 1], { icon: pointIcon('B', color) })
        .bindPopup(`<strong>${escapeHtml(r.customName ?? 'Recorrido')}</strong><br>Fin: ${escapeHtml(r.endNeighborhood)}`)
        .addTo(this.routesLayer);

      latlngs.forEach((ll) => bounds.extend(ll));
    }

    // Encuadra los recorridos la primera vez que hay datos
    if (!this.fittedView && bounds.isValid() && !this.pointA() && !this.pointB()) {
      this.map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
      this.fittedView = true;
    }
  }

  private drawSelection(): void {
    const a = this.pointA();
    const b = this.pointB();
    if (!this.map) return;

    this.selectionLayer.clearLayers();
    if (a) L.marker([a.latitude, a.longitude], { icon: pointIcon('A', '#6922c5', true) }).addTo(this.selectionLayer);
    if (b) L.marker([b.latitude, b.longitude], { icon: pointIcon('B', '#c026d3', true) }).addTo(this.selectionLayer);
    if (a && b) {
      L.polyline([[a.latitude, a.longitude], [b.latitude, b.longitude]], {
        color: '#f5f3ff', weight: 4, opacity: 0.95, dashArray: '2 8', lineCap: 'round',
      }).addTo(this.selectionLayer);
      this.map.fitBounds(
        [[a.latitude, a.longitude], [b.latitude, b.longitude]],
        { padding: [64, 64], maxZoom: 16 }
      );
    }
  }

  private drawPlaces(): void {
    const places = this.savedLocations();
    if (!this.map) return;

    this.placesLayer.clearLayers();
    for (const place of places) {
      if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) continue;
      L.circleMarker([place.lat, place.lng], {
        radius: 6, color: '#ffffff', weight: 2, fillColor: '#7c3aed', fillOpacity: 1,
      })
        .bindTooltip(escapeHtml(place.name))
        .on('click', (e: L.LeafletMouseEvent) => {
          // Si se está eligiendo un punto, el lugar guardado lo fija con su nombre
          const point = this.selectingPoint();
          if (!point) return;
          L.DomEvent.stopPropagation(e);
          this.selectLocation(place);
        })
        .addTo(this.placesLayer);
    }
  }

  colorDe(r: SavedRoute, list = this.routes()): string {
    const i = list.findIndex((x) => x.id === r.id);
    return COLORS[(i < 0 ? 0 : i) % COLORS.length];
  }

  // ── Selección de puntos ────────────────────────
  setMethod(method: SelectionMethod): void {
    this.selectionMethod.set(method);
    this.selectingPoint.set(null);
  }

  choosePoint(point: 'A' | 'B'): void {
    this.error.set('');
    this.selectingPoint.set(this.selectingPoint() === point ? null : point);
  }

  selectLocation(place: FrequentPlace): void {
    const point = this.selectingPoint();
    if (!point) return;
    this.setPoint(point, { latitude: place.lat, longitude: place.lng, nombre: place.name });
  }

  useMyLocation(point: 'A' | 'B'): void {
    if (!navigator.geolocation) {
      this.error.set('Tu navegador no permite obtener la ubicación.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => this.setPoint(point, {
        latitude: pos.coords.latitude, longitude: pos.coords.longitude, nombre: 'Mi ubicación',
      }),
      () => this.error.set('No se pudo obtener tu ubicación. Revisa los permisos del navegador.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  private setPoint(point: 'A' | 'B', value: SelectedPoint): void {
    if (point === 'A') {
      this.pointA.set(value);
      if (value.nombre) this.pointAName.set(value.nombre);
    } else {
      this.pointB.set(value);
      if (value.nombre) this.pointBName.set(value.nombre);
    }
    // Tras fijar A, pasa directo a elegir B
    this.selectingPoint.set(point === 'A' && !this.pointB() ? 'B' : null);
  }

  clearSelection(): void {
    this.pointA.set(null);
    this.pointB.set(null);
    this.pointAName.set('');
    this.pointBName.set('');
    this.routeName.set('');
    this.selectingPoint.set(null);
    this.error.set('');
  }

  // ── Acciones sobre recorridos ──────────────────
  async saveRoute(): Promise<void> {
    const a = this.pointA();
    const b = this.pointB();
    if (!a || !b || this.saving()) return;

    const start = this.pointAName().trim() || a.nombre || 'Punto A';
    const end = this.pointBName().trim() || b.nombre || 'Punto B';

    this.saving.set(true);
    const result = await this.routesService.addRoute({
      nombre: this.routeName().trim() || `Ruta ${start} → ${end}`,
      start,
      end,
      puntos: [
        { latitude: a.latitude, longitude: a.longitude, timestamp: '' },
        { latitude: b.latitude, longitude: b.longitude, timestamp: '' },
      ],
      distanceKm: this.distanceKm() ?? 0,
      estimatedMinutes: this.estimatedMinutes() ?? 0,
    });
    this.saving.set(false);

    if (!result.ok) {
      this.error.set(result.error ?? 'No se pudo guardar el recorrido.');
      return;
    }
    this.clearSelection();
    this.fittedView = false;
    this.show(this.success, 'Recorrido guardado. Ya aparece también en la app móvil.');
  }

  async toggleStar(r: SavedRoute, event?: Event): Promise<void> {
    event?.stopPropagation();
    const result = await this.routesService.toggleImportant(r.id);
    if (!result.ok) this.show(this.notice, result.error ?? '');
    this.syncSelection();
  }

  async delete(r: SavedRoute, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!confirm(`¿Eliminar el recorrido "${r.customName ?? 'sin nombre'}"? También se borrará de la app móvil.`)) {
      return;
    }
    const result = await this.routesService.deleteRoute(r.id);
    if (!result.ok) {
      this.show(this.notice, result.error ?? '');
      return;
    }
    if (this.selected()?.id === r.id) this.selected.set(null);
    if (this.detail()?.id === r.id) this.detail.set(null);
  }

  setVisibility(filter: VisibilityFilter): void {
    this.visibilityFilter.set(filter);
    if (filter === 'ocultar') this.selected.set(null);
  }

  focus(r: SavedRoute): void {
    this.selected.set(this.selected()?.id === r.id ? null : r);
    if (!this.selected() || !this.map || r.puntos.length < 2) return;

    // Si el filtro lo esconde, mostrarlo
    if (this.visibilityFilter() === 'ocultar' || (this.visibilityFilter() === 'estrellas' && !r.important)) {
      this.visibilityFilter.set('todos');
    }
    this.map.flyToBounds(
      L.latLngBounds(r.puntos.map((p) => [p.latitude, p.longitude] as L.LatLngTuple)),
      { padding: [64, 64], maxZoom: 16, duration: 0.8 }
    );
  }

  viewDetail(r: SavedRoute): void {
    this.detail.set(r);
    this.focus(r);
    if (this.selected()?.id !== r.id) this.selected.set(r);
  }

  closeDetail(): void {
    this.detail.set(null);
  }

  setTab(tab: SubTab): void {
    this.activeTab.set(tab);
    this.selectingPoint.set(null);
  }

  formatDate(fecha: string): string {
    const d = new Date(fecha);
    return isNaN(d.getTime())
      ? fecha
      : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatMinutes(min: number | null): string {
    if (min == null) return '—';
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}min`;
  }

  coordinates(p: SelectedPoint): string {
    return `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`;
  }

  // Mantiene los objetos seleccionados apuntando a la versión actualizada del recorrido
  private syncSelection(): void {
    const search = (r: SavedRoute | null) => (r ? this.routes().find((x) => x.id === r.id) ?? null : null);
    this.selected.set(search(this.selected()));
    this.detail.set(search(this.detail()));
  }

  private show(signalStrength: WritableSignal<string>, message: string): void {
    signalStrength.set(message);
    setTimeout(() => {
      if (signalStrength() === message) signalStrength.set('');
    }, 4000);
  }
}

function haversineKm(a: SelectedPoint, b: SelectedPoint): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function pointIcon(letter: string, color: string, large = false): L.DivIcon {
  const size = large ? 34 : 26;
  return L.divIcon({
    className: 'gr-pin',
    html: `<span class="gr-pin__dot${large ? ' gr-pin__dot--lg' : ''}" style="background:${color}">${letter}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
