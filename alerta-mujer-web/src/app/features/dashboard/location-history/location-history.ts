// location-history.ts
import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { LocationTabsComponent } from '../../../shared/components/location-tabs/location-tabs';
import { PhoneLocationService } from '../../../core/services/phone.location.services';
import { FrequentPlaceService } from '../../../core/services/frequent-places.service';
import { FrequentPlace } from '../../../core/models/frequent-place.model';
import { UbicacionEntry } from '../../../core/models/location.model';
import { AuthService } from '../../../core/auth/auth.service';

type TipoFiltro = 'todos' | 'frecuentes' | 'otros';

// Fix del icono por defecto de Leaflet: con Angular/esbuild las rutas relativas
// a marker-icon.png / marker-icon-2x.png / marker-shadow.png no se resuelven
// y el marcador queda invisible (o rompe la carga). Se apuntan a la CDN.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

@Component({
  selector: 'app-location-history',
  standalone: true,
  imports: [CommonModule, LocationTabsComponent],
  templateUrl: './location-history.html',
  styleUrl: './location-history.scss'
})
export class LocationHistoryComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private phoneLocationService = inject(PhoneLocationService);
  private lugaresService = inject(FrequentPlaceService);
  private authService = inject(AuthService);

  private map!: L.Map;
  private viewReady = false;
  private dataReady = false;
  private usuarioId = 0;

  cargando = true;
  error = false;

  showDateDropdown = signal(false);
  showTipoDropdown = signal(false);
  tipoFiltro = signal<TipoFiltro>('todos');
  tipoLabels: Record<TipoFiltro, string> = { todos: 'Todos', frecuentes: 'Lugares frecuentes', otros: 'Otros lugares' };

  weekDayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  selectedDate = signal<Date>(new Date());
  calendarMonth = signal<Date>(new Date());

  history = signal<UbicacionEntry[]>([]);
  nombresFrecuentes = signal<Set<string>>(new Set());

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
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, m, 0).getDate();
    const cells: { date: Date; inMonth: boolean; isToday: boolean; isSelected: boolean; key: string }[] = [];
    for (let i = firstWeekday - 1; i >= 0; i--) cells.push(this.buildCell(new Date(year, m - 1, daysInPrevMonth - i), false));
    for (let d = 1; d <= daysInMonth; d++) cells.push(this.buildCell(new Date(year, m, d), true));
    while (cells.length < 42) {
      const next = new Date(cells[cells.length - 1].date);
      next.setDate(next.getDate() + 1);
      cells.push(this.buildCell(next, false));
    }
    return cells;
  });

  private buildCell(date: Date, inMonth: boolean) {
    return {
      date, inMonth,
      isToday: this.isSameDay(date, new Date()),
      isSelected: this.isSameDay(date, this.selectedDate()),
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
    };
  }

  private isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  prevMonth() { const m = this.calendarMonth(); this.calendarMonth.set(new Date(m.getFullYear(), m.getMonth() - 1, 1)); }
  nextMonth() { const m = this.calendarMonth(); this.calendarMonth.set(new Date(m.getFullYear(), m.getMonth() + 1, 1)); }

  selectDate(date: Date) {
    this.selectedDate.set(date);
    this.calendarMonth.set(new Date(date.getFullYear(), date.getMonth(), 1));
    this.showDateDropdown.set(false);
  }

  selectTipo(t: TipoFiltro) { this.tipoFiltro.set(t); this.showTipoDropdown.set(false); }

  esFrecuente(entry: UbicacionEntry) {
    return this.nombresFrecuentes().has(entry.address);
  }

  filteredHistory = computed(() => {
    const all = this.history();
    const hasDates = all.some(e => !!e.date);
    let base = hasDates ? all.filter(e => e.date && this.isSameDay(new Date(e.date), this.selectedDate())) : all;
    const tipo = this.tipoFiltro();
    if (tipo === 'frecuentes') base = base.filter(e => this.esFrecuente(e));
    if (tipo === 'otros') base = base.filter(e => !this.esFrecuente(e));
    return base;
  });

  ngOnInit() {
    this.authService.currentUser$.subscribe((usuario: any) => {
      if (!usuario) { this.error = true; this.cargando = false; return; }
      this.usuarioId = usuario.id ?? usuario.usuarioId ?? 1;
      this.loadData();
    });
  }

  private loadData() {
    this.cargando = true;
    this.error = false;

    this.phoneLocationService.getByUsuario(this.usuarioId).subscribe({
      next: (data) => {
        this.history.set(data);
        this.cargando = false;
        this.dataReady = true;
        this.tryInitMap();
      },
      error: () => { this.error = true; this.cargando = false; },
    });

    this.lugaresService.getByUser(this.usuarioId).subscribe((places: FrequentPlace[]) => {
      this.nombresFrecuentes.set(new Set(places.map((p: FrequentPlace) => p.address)));
    });
  }

  ngAfterViewInit() { this.viewReady = true; this.tryInitMap(); }

  private tryInitMap() {
    if (!this.viewReady || !this.dataReady || this.history().length === 0 || this.map) return;
    const history = this.history();

    this.map = L.map(this.mapContainer.nativeElement, { zoomControl: true, scrollWheelZoom: false });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.map);

    history.forEach(e => {
      L.marker([e.lat, e.lng]).addTo(this.map).bindPopup(`<b>${e.time}</b><br>${e.address}`);
    });

    const coords: L.LatLngExpression[] = history.map(e => [e.lat, e.lng]);
    const polyline = L.polyline(coords, { color: '#7c3aed', weight: 3, opacity: 0.8 }).addTo(this.map);
    this.map.fitBounds(polyline.getBounds(), { padding: [40, 40] });

    setTimeout(() => this.map.invalidateSize(), 0);
  }

  flyTo(entry: UbicacionEntry) {
    this.map?.flyTo([entry.lat, entry.lng], 16, { duration: 1 });
  }

  verRecorridoCompleto() {
    this.tipoFiltro.set('todos');
    this.mapContainer?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  ngOnDestroy() { if (this.map) this.map.remove(); }
}