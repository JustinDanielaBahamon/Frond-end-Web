import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import * as L from 'leaflet';
import { LocationTabsComponent } from '../../../shared/components/location-tabs/location-tabs';
import { PhoneLocationService } from '../../../core/services/phone.location.services';
import { FrequentPlaceService } from '../../../core/services/frequent-places.service';
import { NearbyZoneService } from '../../../core/services/nearby-zone.service';
import { UbicacionEntry } from '../../../core/models/location.model';
import { FrequentPlace } from '../../../core/models/frequent-place.model';
import { NearbyZone } from '../../../core/models/nearby-zone.model';
import { AuthService } from '../../../core/auth/auth.service';
import { distanciaKm, markerIcon } from '../../../core/utils/geo.util';

const youIcon = L.divIcon({
  className: '',
  html: `<div class="mu-you-marker"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

@Component({
  selector: 'app-my-location',
  standalone: true,
  imports: [CommonModule, LocationTabsComponent],
  templateUrl: './my-location.html',
  styleUrl: './my-location.scss'
})
export class MyLocationComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private phoneLocationService = inject(PhoneLocationService);
  private frequentPlaceService = inject(FrequentPlaceService);
  private zoneService = inject(NearbyZoneService);
  private authService = inject(AuthService);

  private map: L.Map | null = null;
  private viewReady = false;
  private userId = 0;

  loading = true;
  error = false;

  currentLocation = signal<UbicacionEntry | null>(null);
  currentPlace = signal<FrequentPlace | null>(null);
  // Solo se muestra si la ubicación real está dentro del radio de la zona.
  zonaSegura = signal<NearbyZone | null>(null);
  zonaRiesgo = signal<NearbyZone | null>(null);
  zonasSeguras = signal<NearbyZone[]>([]);

  // El mapa solo se dibuja cuando hay coordenadas reales.
  mapaVacio = computed(
    () =>
      !this.currentLocation() &&
      this.currentPlace() === null &&
      this.zonasSeguras().length === 0,
  );

  updatedLabel = computed(() => {
    const loc = this.currentLocation();
    if (!loc) return '—';
    const iso = loc.recordedAt ? `${loc.recordedAt}Z` : '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return loc.time || '—';
    return `${d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`;
  });

  ngOnInit() {
    this.authService.currentUser$.subscribe((user: any) => {
      if (!user) { this.error = true; this.loading = false; return; }
      this.userId = user.id ?? user.usuarioId ?? 1;
      this.loadData();
    });
  }

  private loadData() {
    this.loading = true;
    this.error = false;

    forkJoin([
      this.seguro(this.phoneLocationService.getByUsuario(this.userId)),
      this.seguro(this.frequentPlaceService.getByUser(this.userId)),
      this.seguro(this.zoneService.getByUser(this.userId)),
    ]).subscribe({
      next: ([locs, places, zones]) => {
        // El backend no garantiza orden: se toma la más reciente por recordedAt.
        const ordenados = [...locs].sort(
          (a, b) => this.fechaValor(b.recordedAt) - this.fechaValor(a.recordedAt),
        );
        const ultima = ordenados[0] ?? null;

        this.currentLocation.set(ultima);
        this.currentPlace.set(places[0] ?? null);
        this.zonasSeguras.set(zones.filter((z) => z.type === 'safe'));

        // Una zona solo aplica si la coordenada real cae dentro de su radio.
        const dentro = ultima
          ? zones.filter((z) =>
              distanciaKm(ultima.lat, ultima.lng, z.lat, z.lng) * 1000 <= z.radiusMeters,
            )
          : [];
        this.zonaSegura.set(dentro.find((z) => z.type === 'safe') ?? null);
        this.zonaRiesgo.set(dentro.find((z) => z.type === 'risk') ?? null);

        this.loading = false;
        // El contenedor del mapa solo existe cuando hay datos: se espera
        // a que Angular lo renderice antes de crear el mapa.
        setTimeout(() => this.tryInitMap(), 0);
      },
      error: () => { this.error = true; this.loading = false; },
    });
  }

  /** Un endpoint caído no debe dejar la pestaña entera sin datos. */
  private seguro<T>(obs: Observable<T[]>): Observable<T[]> {
    return obs.pipe(catchError(() => of([])));
  }

  private fechaValor(raw?: string): number {
    if (!raw) return NaN;
    const iso = raw.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}Z`;
    const t = new Date(iso).getTime();
    return isNaN(t) ? NaN : t;
  }

  ngAfterViewInit() {
    this.viewReady = true;
    // Si los datos llegaron antes de que la vista estuviera lista,
    // se crea el mapa ahora (y se fuerza el recálculo de tamaño).
    this.tryInitMap();
    setTimeout(() => this.map?.invalidateSize(), 100);
  }

  private tryInitMap(): void {
    if (!this.viewReady || this.map) return;
    const loc = this.currentLocation();
    const places = this.currentPlace() ? [this.currentPlace()!] : [];
    const zonas = this.zonasSeguras();
    if (!loc && places.length === 0 && zonas.length === 0) return;

    const contenedor = this.mapContainer?.nativeElement;
    if (!contenedor) return;

    const centro: L.LatLngExpression = loc
      ? [loc.lat, loc.lng]
      : places.length > 0
        ? [places[0].lat, places[0].lng]
        : [zonas[0].lat, zonas[0].lng];

    this.map = L.map(contenedor, {
      center: centro,
      zoom: 15,
      scrollWheelZoom: false,
    });
    const mapa = this.map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(mapa);

    const puntos: L.LatLngExpression[] = [];

    if (loc) {
      L.marker([loc.lat, loc.lng], { icon: youIcon })
        .addTo(mapa)
        .bindPopup(`Tu ubicación<br>${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`);
      puntos.push([loc.lat, loc.lng]);
    }

    places.forEach((p) => {
      L.marker([p.lat, p.lng], { icon: markerIcon('#7c3aed') })
        .addTo(mapa)
        .bindPopup(`${p.name}<br>${p.address || `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`}`);
      puntos.push([p.lat, p.lng]);
    });

    zonas.forEach((z) => {
      L.marker([z.lat, z.lng], { icon: markerIcon('#16a34a') })
        .addTo(mapa)
        .bindPopup(`${z.name}<br>${z.address || `${z.lat.toFixed(6)}, ${z.lng.toFixed(6)}`}`);
      puntos.push([z.lat, z.lng]);
    });

    if (puntos.length > 1) {
      mapa.fitBounds(L.latLngBounds(puntos), { padding: [40, 40] });
    }

    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  viewOnMap() {
    this.mapContainer?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
