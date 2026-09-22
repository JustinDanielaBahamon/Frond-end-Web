// nearby-zones.ts
import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { LocationTabsComponent } from '../../../shared/components/location-tabs/location-tabs';
import { NearbyZoneService } from '../../../core/services/nearby-zone.service';
import { NearbyZone, ZoneType } from '../../../core/models/nearby-zone.model';
import { AuthService } from '../../../core/auth/auth.service';

type ZoneFilter = 'all' | ZoneType;

const ZONE_COLORS: Record<ZoneType, string> = { safe: '#16a34a', risk: '#dc2626', help: '#7c3aed' };

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
  private authService = inject(AuthService);

  private map!: L.Map;
  private viewReady = false;
  private userId = 0;

  loading = true;
  error = false;
  filter = signal<ZoneFilter>('all');

  zones = signal<NearbyZone[]>([]);

  filteredZones = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.zones() : this.zones().filter(z => z.type === f);
  });

  colorFor(type: ZoneType) { return ZONE_COLORS[type]; }

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
    this.zoneService.getByUser(this.userId).subscribe({
      next: (data) => { this.zones.set(data); this.loading = false; this.initMapIfReady(); },
      error: () => { this.error = true; this.loading = false; },
    });
  }

  ngAfterViewInit() { this.viewReady = true; this.initMapIfReady(); }

  private initMapIfReady() {
    if (!this.viewReady || this.zones().length === 0 || this.map) return;
    const zones = this.zones();

    this.map = L.map(this.mapContainer.nativeElement, { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.map);

    const circles: L.Circle[] = [];
    zones.forEach(z => {
      const circle = L.circle([z.lat, z.lng], {
        radius: z.radiusMeters,
        color: this.colorFor(z.type),
        fillColor: this.colorFor(z.type),
        fillOpacity: 0.18,
        weight: 1.5,
      }).addTo(this.map).bindPopup(`<b>${z.name}</b><br>${z.description}`);
      circles.push(circle);
    });

    const group = L.featureGroup(circles);
    this.map.fitBounds(group.getBounds(), { padding: [40, 40] });

    setTimeout(() => this.map.invalidateSize(), 0);
  }

  setFilter(f: ZoneFilter) { this.filter.set(f); }

  viewOnMap(zone: NearbyZone) {
    this.mapContainer?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.map?.flyTo([zone.lat, zone.lng], 16, { duration: 1 });
  }

  ngOnDestroy() { if (this.map) this.map.remove(); }
}