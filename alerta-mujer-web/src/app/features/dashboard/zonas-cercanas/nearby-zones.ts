// nearby-zones.ts
import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import * as L from 'leaflet';
import { LocationTabsComponent } from '../../../shared/components/location-tabs/location-tabs';
import { NearbyZoneService } from '../../../core/services/nearby-zone.service';
import { AssistanceService } from '../../../core/services/assistance.service';
import { PhoneLocationService } from '../../../core/services/phone.location.services';
import { NearbyZone, ZoneType } from '../../../core/models/nearby-zone.model';
import { CentroAyuda } from '../../../core/models/assistance.model';
import { UbicacionEntry } from '../../../core/models/location.model';
import { AuthService } from '../../../core/auth/auth.service';
import { distanciaKm } from '../../../core/utils/geo.util';

type ZoneFilter = 'all' | ZoneType;

const ZONE_COLORS: Record<ZoneType, string> = { safe: '#16a34a', risk: '#dc2626', help: '#7c3aed' };

// Los recursos de emergencia no traen radio en el backend:
// se dibujan con un radio fijo pequeño para que el círculo sea visible.
const RADIO_CENTRO_METROS = 200;

// Los ids de zonas y de recursos son independientes: se desplazan
// los ids de centros para que no colisionen en el track del listado.
const DESPLAZAMIENTO_CENTROS = 1000;

@Component({
  selector: 'app-nearby-zones',
  standalone: true,
  imports: [CommonModule, LocationTabsComponent],
  templateUrl: './nearby-zones.html',
  styleUrl: './nearby-zones.scss'
})
export class NearbyZonesComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private zoneService = inject(NearbyZoneService);
  private assistanceService = inject(AssistanceService);
  private phoneLocationService = inject(PhoneLocationService);
  private authService = inject(AuthService);

  private map: L.Map | null = null;
  private viewReady = false;
  private userId = 0;

  loading = true;
  error = false;
  filter = signal<ZoneFilter>('all');

  zones = signal<NearbyZone[]>([]);
  // Punto de referencia real: la última ubicación registrada.
  ubicacionReferencia = signal<UbicacionEntry | null>(null);

  // Sin ubicación de referencia no se puede hablar de "cercanía".
  sinReferencia = computed(() => this.ubicacionReferencia() === null);

  filteredZones = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.zones() : this.zones().filter(z => z.type === f);
  });

  colorFor(type: ZoneType) { return ZONE_COLORS[type]; }

  distanciaTexto(zone: NearbyZone): string {
    return zone.distanceKm !== undefined
      ? `${zone.distanceKm.toFixed(1)} km`
      : '—';
  }

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
      this.seguro(this.zoneService.getByUser(this.userId)),
      this.seguro(this.phoneLocationService.getByUsuario(this.userId)),
      this.seguro(this.assistanceService.getCentros()),
    ]).subscribe({
      next: ([zonas, locs, centros]) => {
        // La distancia se calcula en el frontend: el backend no la expone y
        // todos los datos necesarios (zona + última ubicación) ya están aquí.
        const ultima = [...locs].sort(
          (a, b) =>
            new Date(b.recordedAt ?? '').getTime() - new Date(a.recordedAt ?? '').getTime(),
        )[0];

        this.ubicacionReferencia.set(ultima ?? null);

        const todos: NearbyZone[] = [
          ...zonas,
          // Centros de ayuda reales (recursos de emergencia del backend):
          // alimentan el chip y la leyenda "Centro de ayuda" que ya
          // existe en esta pantalla. Solo los que tienen coordenadas.
          ...centros
            .filter((c) => c.lat !== 0 || c.lng !== 0)
            .map((c) => this.centroATabla(c)),
        ];

        const conDistancia = todos.map((z) => ({
          ...z,
          distanceKm: ultima ? distanciaKm(ultima.lat, ultima.lng, z.lat, z.lng) : undefined,
        }));

        // "Cercanas" = orden real por distancia desde la última ubicación.
        conDistancia.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

        this.zones.set(conDistancia);
        this.loading = false;
        this.initMapIfReady();
      },
      error: () => { this.error = true; this.loading = false; },
    });
  }

  /** Adapta un CentroAyuda (EmergencyResource del backend) al modelo
   *  de esta pestaña. El backend no expone radio ni distancia para
   *  recursos: el radio es fijo y la distancia se calcula abajo. */
  private centroATabla(c: CentroAyuda): NearbyZone {
    return {
      id: c.id + DESPLAZAMIENTO_CENTROS,
      name: c.nombre,
      type: 'help',
      description: c.descripcion,
      address: c.address,
      city: c.city,
      lat: c.lat,
      lng: c.lng,
      radiusMeters: RADIO_CENTRO_METROS,
    };
  }

  private seguro<T>(obs: Observable<T[]>): Observable<T[]> {
    return obs.pipe(catchError(() => of([])));
  }

  ngAfterViewInit() {
    this.viewReady = true;
    this.initMapIfReady();
    setTimeout(() => this.map?.invalidateSize(), 100);
  }

  private initMapIfReady() {
    if (!this.viewReady || this.zones().length === 0 || this.map) return;
    const zones = this.zones();

    const contenedor = this.mapContainer?.nativeElement;
    if (!contenedor) return;

    this.map = L.map(contenedor, { scrollWheelZoom: false, zoomControl: true });
    const mapa = this.map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(mapa);

    const circles: L.Circle[] = [];
    zones.forEach(z => {
      const circle = L.circle([z.lat, z.lng], {
        radius: z.radiusMeters,
        color: this.colorFor(z.type),
        fillColor: this.colorFor(z.type),
        fillOpacity: 0.18,
        weight: 1.5,
      }).addTo(mapa).bindPopup(
        `<b>${z.name}</b><br>${z.description}<br>${z.address || `${z.lat.toFixed(6)}, ${z.lng.toFixed(6)}`}`,
      );
      circles.push(circle);
    });

    const group = L.featureGroup(circles);
    mapa.fitBounds(group.getBounds(), { padding: [40, 40] });

    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  setFilter(f: ZoneFilter) { this.filter.set(f); }

  viewOnMap(zone: NearbyZone) {
    this.mapContainer?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.map?.flyTo([zone.lat, zone.lng], 16, { duration: 1 });
  }

  ngOnDestroy() { if (this.map) { this.map.remove(); this.map = null; } }
}
