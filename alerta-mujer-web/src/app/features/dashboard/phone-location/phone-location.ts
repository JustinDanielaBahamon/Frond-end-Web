import { Component, signal, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { PhoneLocationService } from '../../../core/services/phone.location.services';
import { UbicacionEntry } from '../../../core/models/location.model';
import { AuthService } from '../../../core/auth/auth.service';

const iconDefault = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const iconRed = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = iconDefault;

@Component({
  selector: 'app-phone-location',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './phone-location.html',
  styleUrl: './phone-location.scss'
})
export class PhoneLocationComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private phoneLocationService = inject(PhoneLocationService);
  private authService = inject(AuthService);

  private map!: L.Map;
  private markers: L.Marker[] = [];
  private polyline!: L.Polyline;

  private viewReady = false;
  private dataReady = false;
  private mapInitialized = false;

  cargando = true;
  error = false;

  selectedDevice = signal('Dispositivo 1');
  selectedDateRange = signal('Hoy');
  devices = ['Dispositivo 1', 'Dispositivo 2'];
  dateRanges = ['Hoy', 'Últimos 3 días', 'Última semana'];
  showDeviceDropdown = signal(false);
  showDateDropdown = signal(false);
  isFullscreen = signal(false);
  showFullscreenBtn = signal(false);

  locationHistory = signal<UbicacionEntry[]>([]);
  currentLocation: UbicacionEntry | null = null;
  visibleCount = signal(3);

  get visibleHistory() {
    return this.locationHistory().slice(0, this.visibleCount());
  }

  get hasMore() {
    return this.visibleCount() < this.locationHistory().length;
  }

  loadMore() {
    this.visibleCount.set(this.locationHistory().length);
  }

  ngOnInit() {
    this.authService.currentUser$.subscribe((usuario) => {
      if (!usuario) {
        this.error = true;
        this.cargando = false;
        return;
      }

      this.phoneLocationService.getByUsuario(usuario.id).subscribe({
        next: (data) => {
          this.locationHistory.set(data);
          this.currentLocation = data[0] ?? null;
          this.cargando = false;
          this.dataReady = true;
          this.tryInitMap();
        },
        error: () => {
          this.error = true;
          this.cargando = false;
        },
      });
    });
  }

  ngAfterViewInit() {
    this.viewReady = true;
    this.tryInitMap();
  }

  private tryInitMap() {
    if (this.viewReady && this.dataReady && !this.mapInitialized && this.locationHistory().length > 0) {
      this.initMap();
      this.mapInitialized = true;
    }
  }

  private initMap() {
    const history = this.locationHistory();
    const center = history[0];

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [center.lat, center.lng],
      zoom: 15,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    const currentIcon = L.divIcon({
      className: '',
      html: `<div class="you-marker">YOU</div>`,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });

    const currentMarker = L.marker([center.lat, center.lng], { icon: currentIcon })
      .addTo(this.map)
      .bindPopup(`<b>Ubicación actual</b><br>${center.address}<br>${center.time}`);
    this.markers.push(currentMarker);

    const rest = history.slice(1);
    rest.forEach(entry => {
      const marker = L.marker([entry.lat, entry.lng], { icon: iconRed })
        .addTo(this.map)
        .bindPopup(`<b>${entry.time}</b><br>${entry.address}<br>GPS: ${entry.gpsSignal} | Batería: ${entry.battery}%`);
      this.markers.push(marker);
    });

    const coords: L.LatLngExpression[] = history.map(e => [e.lat, e.lng]);
    this.polyline = L.polyline(coords, {
      color: '#7c3aed',
      weight: 3,
      opacity: 0.7,
      dashArray: '6, 6',
    }).addTo(this.map);

    this.map.fitBounds(this.polyline.getBounds(), { padding: [40, 40] });
  }

  onMapMouseEnter() {
    this.showFullscreenBtn.set(true);
    this.map?.scrollWheelZoom.enable();
  }

  onMapMouseLeave() {
    this.showFullscreenBtn.set(false);
    this.map?.scrollWheelZoom.disable();
  }

  toggleFullscreen() {
    const el = this.mapContainer.nativeElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen();
      this.isFullscreen.set(true);
    } else {
      document.exitFullscreen();
      this.isFullscreen.set(false);
    }
  }

  flyTo(entry: UbicacionEntry) {
    this.map?.flyTo([entry.lat, entry.lng], 16, { duration: 1 });
    this.currentLocation = entry;
  }

  selectDevice(d: string) {
    this.selectedDevice.set(d);
    this.showDeviceDropdown.set(false);
  }

  selectDateRange(r: string) {
    this.selectedDateRange.set(r);
    this.showDateDropdown.set(false);
  }

  signalColor(sig: string) {
    if (sig === 'Fuerte')   return 'text-green-600';
    if (sig === 'Moderada') return 'text-yellow-500';
    return 'text-red-500';
  }

  ngOnDestroy() {
    if (this.map) this.map.remove();
  }
}