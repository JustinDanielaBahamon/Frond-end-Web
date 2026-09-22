import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { LocationTabsComponent } from '../../../shared/components/location-tabs/location-tabs';
import { PhoneLocationService } from '../../../core/services/phone.location.services';
import { FrequentPlaceService } from '../../../core/services/frequent-places.service';
import { NearbyZoneService } from '../../../core/services/nearby-zone.service';
import { UbicacionEntry } from '../../../core/models/location.model';
import { FrequentPlace } from '../../../core/models/frequent-place.model';
import { NearbyZone } from '../../../core/models/nearby-zone.model';
import { AuthService } from '../../../core/auth/auth.service';

const youIcon = L.divIcon({
  className: '',
  html: `<div class="mu-you-marker"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const safeZoneIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
});

const frequentPlaceIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
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

  private map!: L.Map;
  private viewReady = false;
  private dataReady = false;
  private userId = 0;

  loading = true;
  error = false;

  currentLocation = signal<UbicacionEntry | null>(null);
  currentPlace = signal<FrequentPlace | null>(null);
  currentZone = signal<NearbyZone | null>(null);

  updatedLabel = computed(() => {
    const loc = this.currentLocation();
    return loc ? `Hoy, ${loc.time}` : '—';
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

    this.phoneLocationService.getByUsuario(this.userId).subscribe({
      next: (data) => {
        this.currentLocation.set(data[0] ?? null);
        this.loading = false;
        this.dataReady = true;
        this.tryInitMap();
      },
      error: () => { this.error = true; this.loading = false; },
    });

    this.frequentPlaceService.getByUser(this.userId).subscribe((places) => {
      this.currentPlace.set(places.find(p => p.isMain) ?? places[0] ?? null);
    });

    this.zoneService.getByUser(this.userId).subscribe((zones) => {
      this.currentZone.set(zones.find(z => z.type === 'safe') ?? null);
    });
  }

  ngAfterViewInit() {
    this.viewReady = true;
    this.tryInitMap();
  }

  private tryInitMap() {
    if (!this.viewReady || !this.dataReady || !this.currentLocation() || this.map) return;
    const loc = this.currentLocation()!;

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [loc.lat, loc.lng],
      zoom: 15,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.map);

    L.marker([loc.lat, loc.lng], { icon: youIcon }).addTo(this.map).bindPopup('Tu ubicación');

    this.frequentPlaceService.getByUser(this.userId).subscribe((places) => {
      places.forEach(p => L.marker([p.lat, p.lng], { icon: frequentPlaceIcon }).addTo(this.map).bindPopup(p.name));
    });

    this.zoneService.getByUser(this.userId).subscribe((zones) => {
      zones.filter(z => z.type === 'safe').forEach(z =>
        L.marker([z.lat, z.lng], { icon: safeZoneIcon }).addTo(this.map).bindPopup(z.name)
      );
    });
  }

  viewOnMap() {
    this.mapContainer?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  ngOnDestroy() {
    if (this.map) this.map.remove();
  }
}