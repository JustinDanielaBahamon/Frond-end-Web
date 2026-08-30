import { Component, computed, signal, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, inject } from '@angular/core';
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

type MapView = 'mapa' | 'satelite' | 'hibrido';

// Los "dispositivos" del filtro mapean al usuarioId de la persona monitoreada
// (ver ubicaciones[].usuarioId en db.json). Ajusta este mapa si tu backend
// expone un endpoint /dispositivos en vez de usuarios.
const DEVICE_TO_USUARIO_ID: Record<string, number> = {
  'Dispositivo 1': 1,
  'Dispositivo 2': 2,
};

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
  private baseLayers: L.TileLayer[] = [];

  private viewReady = false;
  private dataReady = false;
  private mapInitialized = false;

  cargando = true;
  error = false;

  selectedDevice = signal('Dispositivo 1');
  devices = Object.keys(DEVICE_TO_USUARIO_ID);
  showDeviceDropdown = signal(false);
  showDateDropdown = signal(false);
  isFullscreen = signal(false);
  showFullscreenBtn = signal(false);
  mapView = signal<MapView>('mapa');

  // --- Calendario ---
  weekDayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  selectedDate = signal<Date>(new Date());
  calendarMonth = signal<Date>(new Date());

  today() {
    return new Date();
  }

  formattedSelectedDate = computed(() =>
    this.selectedDate().toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  );

  calendarMonthLabel = computed(() =>
    this.calendarMonth().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  );

  calendarDays = computed(() => {
    const month = this.calendarMonth();
    const year = month.getFullYear();
    const m = month.getMonth();

    const firstOfMonth = new Date(year, m, 1);
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // lunes = 0
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, m, 0).getDate();

    const cells: { date: Date; inMonth: boolean; isToday: boolean; isSelected: boolean; key: string }[] = [];

    for (let i = firstWeekday - 1; i >= 0; i--) {
      cells.push(this.buildCalendarCell(new Date(year, m - 1, daysInPrevMonth - i), false));
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(this.buildCalendarCell(new Date(year, m, d), true));
    }
    while (cells.length < 42) {
      const next = new Date(cells[cells.length - 1].date);
      next.setDate(next.getDate() + 1);
      cells.push(this.buildCalendarCell(next, false));
    }
    return cells;
  });

  private buildCalendarCell(date: Date, inMonth: boolean) {
    return {
      date,
      inMonth,
      isToday: this.isSameDay(date, new Date()),
      isSelected: this.isSameDay(date, this.selectedDate()),
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
    };
  }

  private isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  prevMonth() {
    const m = this.calendarMonth();
    this.calendarMonth.set(new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  nextMonth() {
    const m = this.calendarMonth();
    this.calendarMonth.set(new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  selectDate(date: Date) {
    this.selectedDate.set(date);
    this.calendarMonth.set(new Date(date.getFullYear(), date.getMonth(), 1));
    this.showDateDropdown.set(false);
    this.visibleCount.set(this.pageSize);
  }

  locationHistory = signal<UbicacionEntry[]>([]);
  // Convertido a signal (antes era una propiedad plana): lo necesitamos reactivo
  // porque "actualizado hace X" y la sincronización dependen de él.
  currentLocation = signal<UbicacionEntry | null>(null);

  // Filtra el historial por la fecha del calendario. `ubicaciones` en el db.json
  // actual no trae campo `date` por punto (solo `time`) — mientras no lo agregue
  // el backend, se muestra el historial completo sin filtrar por día.
  filteredHistory = computed(() => {
    const all = this.locationHistory();
    const hasDates = all.some(e => !!e.date);
    if (!hasDates) return all;
    const sel = this.selectedDate();
    return all.filter(e => e.date && this.isSameDay(new Date(e.date), sel));
  });

  // El historial se muestra de a `pageSize` (llenando el espacio disponible)
  // en vez de arrancar en 3; "Siguiente" solo aparece si de verdad sobran más.
  private readonly pageSize = 7;
  visibleCount = signal(this.pageSize);

  get visibleHistory() {
    return this.filteredHistory().slice(0, this.visibleCount());
  }

  get hasMore() {
    return this.visibleCount() < this.filteredHistory().length;
  }

  loadMore() {
    this.visibleCount.update(v => Math.min(v + this.pageSize, this.filteredHistory().length));
  }

  // --- "Actualizado hace X min" respecto a la hora actual ---
  updatedAgo = computed(() => {
    const loc = this.currentLocation();
    if (!loc) return '';
    const diffMin = Math.round((Date.now() - this.parseTime(loc.time).getTime()) / 60000);
    if (diffMin <= 0) return 'Justo ahora';
    if (diffMin === 1) return 'Hace 1 min';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    return `Hace ${Math.floor(diffMin / 60)} h`;
  });

  // --- Estado de sincronización, derivado del último punto recibido ---
  syncInfo = computed(() => {
    const loc = this.currentLocation();
    return {
      hace: this.updatedAgo(),
      fechaHora: loc ? `${new Date().toLocaleDateString('es-CO')} ${loc.time}` : '—',
      automatica: true,
    };
  });

  consejosSeguridad = [
    'Activa tu ubicación siempre para que podamos ayudarte más rápido en caso de emergencia.',
    'Comparte tu ruta con tu contacto de confianza antes de salir sola de noche.',
    'Mantén el GPS y los datos móviles activos: sin señal no podemos ubicarte.',
  ];
  consejoActual = this.consejosSeguridad[0];

  ngOnInit() {
    this.authService.currentUser$.subscribe((usuario) => {
      if (!usuario) {
        this.error = true;
        this.cargando = false;
        return;
      }
      this.loadData(DEVICE_TO_USUARIO_ID[this.selectedDevice()]);
    });
  }

  private loadData(usuarioId: number) {
    this.cargando = true;
    this.error = false;
    this.phoneLocationService.getByUsuario(usuarioId).subscribe({
      next: (data) => {
        this.locationHistory.set(data);
        this.currentLocation.set(data[0] ?? null);
        this.visibleCount.set(this.pageSize);
        this.cargando = false;
        this.dataReady = true;
        this.tryInitMap();
        this.refreshMapData();
      },
      error: () => {
        this.error = true;
        this.cargando = false;
      },
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

    this.switchMapView(this.mapView());
    this.renderMarkersAndRoute(history);
  }

  /** Vuelve a dibujar marcadores + ruta cuando cambian los datos (nuevo dispositivo, etc.) */
  private refreshMapData() {
    if (!this.mapInitialized || !this.map) return;
    this.markers.forEach(m => this.map.removeLayer(m));
    this.markers = [];
    if (this.polyline) this.map.removeLayer(this.polyline);
    this.renderMarkersAndRoute(this.locationHistory());
  }

  private renderMarkersAndRoute(history: UbicacionEntry[]) {
    if (history.length === 0) return;
    const center = history[0];

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

    history.slice(1).forEach(entry => {
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

  /** Cambia la capa base del mapa: Mapa (OSM) / Satélite / Híbrido (satélite + límites y nombres) */
  switchMapView(view: MapView) {
    this.mapView.set(view);
    if (!this.map) return;

    this.baseLayers.forEach(layer => this.map.removeLayer(layer));
    this.baseLayers = [];

    if (view === 'mapa') {
      this.baseLayers.push(
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(this.map)
      );
    } else if (view === 'satelite') {
      this.baseLayers.push(
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles © Esri',
          maxZoom: 19,
        }).addTo(this.map)
      );
    } else {
      this.baseLayers.push(
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles © Esri',
          maxZoom: 19,
        }).addTo(this.map)
      );
      this.baseLayers.push(
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
        }).addTo(this.map)
      );
    }
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
    this.currentLocation.set(entry);
  }

  /** Botón "Ver en mapa" del historial: hace scroll al mapa y reencuadra la ruta completa */
  verEnMapa() {
    this.mapContainer?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (this.polyline) {
      this.map?.fitBounds(this.polyline.getBounds(), { padding: [40, 40] });
    }
  }

  /** Botón "Exportar": descarga el historial filtrado (por fecha) como CSV, sin llamadas al backend */
  exportarHistorial() {
    const filas = [
      ['#', 'Hora', 'Dirección', 'Señal GPS', 'Batería'],
      ...this.filteredHistory().map((e, i) => [String(i + 1), e.time, e.address, e.gpsSignal, `${e.battery}%`]),
    ];
    const csv = filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial-ubicaciones-${this.selectedDevice()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  selectDevice(d: string) {
    this.selectedDevice.set(d);
    this.showDeviceDropdown.set(false);
    this.mapInitialized = false; // fuerza reinit del mapa con el nuevo dataset
    if (this.map) { this.map.remove(); this.mapInitialized = false; }
    this.loadData(DEVICE_TO_USUARIO_ID[d]);
  }

  signalColor(sig: string) {
    if (sig === 'Fuerte') return 'text-green-600';
    if (sig === 'Moderada') return 'text-yellow-500';
    return 'text-red-500';
  }

  batteryColor(pct: number) {
    if (pct >= 50) return 'battery-ok';
    if (pct >= 20) return 'battery-mid';
    return 'battery-low';
  }

  // --- Utilidad de tiempo ---

  /** Convierte "11:30 AM" -> Date de hoy con esa hora, para poder restar tiempos */
  private parseTime(t: string): Date {
    const [time, meridiem] = t.trim().split(' ');
    let [h, m] = time.split(':').map(Number);
    if (meridiem?.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (meridiem?.toUpperCase() === 'AM' && h === 12) h = 0;
    const d = new Date();
    d.setHours(h, m || 0, 0, 0);
    return d;
  }

  ngOnDestroy() {
    if (this.map) this.map.remove();
  }
}