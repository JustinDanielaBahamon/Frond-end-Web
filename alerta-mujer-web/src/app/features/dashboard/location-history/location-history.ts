// location-history.ts
import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import * as L from 'leaflet';
import { LocationTabsComponent } from '../../../shared/components/location-tabs/location-tabs';
import { PhoneLocationService } from '../../../core/services/phone.location.services';
import { FrequentPlaceService } from '../../../core/services/frequent-places.service';
import { FrequentPlace } from '../../../core/models/frequent-place.model';
import { UbicacionEntry } from '../../../core/models/location.model';
import { AuthService } from '../../../core/auth/auth.service';
import { markerIcon } from '../../../core/utils/geo.util';

type TipoFiltro = 'todos' | 'frecuentes' | 'otros';

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

  private map: L.Map | null = null;
  private viewReady = false;
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

  /** Compara 'YYYY-MM-DD' del backend con una Date local, sin pasar por UTC
   *  (new Date('YYYY-MM-DD') se parsea como UTC y desfasa un día en Colombia). */
  private mismaFechaStr(dateStr: string | undefined, d: Date): boolean {
    if (!dateStr) return false;
    const partes = dateStr.split('-');
    if (partes.length !== 3) return false;
    const y = Number(partes[0]);
    const m = Number(partes[1]);
    const dia = Number(partes[2]);
    return y === d.getFullYear() && m === d.getMonth() + 1 && dia === d.getDate();
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

  /** La dirección real del backend; si no la hay, las coordenadas. */
  descripcion(entry: UbicacionEntry): string {
    if (entry.address) return entry.address;
    if (entry.lat || entry.lng) return `${entry.lat.toFixed(6)}, ${entry.lng.toFixed(6)}`;
    return 'Sin dirección registrada';
  }

  filteredHistory = computed(() => {
    const all = this.history();
    const hasDates = all.some(e => !!e.date);
    let base = hasDates ? all.filter(e => e.date && this.mismaFechaStr(e.date, this.selectedDate())) : all;
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

    forkJoin([
      this.seguro(this.phoneLocationService.getByUsuario(this.usuarioId)),
      this.seguro(this.lugaresService.getByUser(this.usuarioId)),
    ]).subscribe({
      next: ([data, places]) => {
        // Orden real: la más reciente primero (el backend no garantiza orden).
        const ordenadas = [...data].sort((a, b) =>
          new Date(b.recordedAt ?? '').getTime() - new Date(a.recordedAt ?? '').getTime(),
        );
        this.history.set(ordenadas);
        this.nombresFrecuentes.set(new Set(places.map((p: FrequentPlace) => p.address).filter(Boolean)));
        this.cargando = false;

        // Fecha por defecto = el día con más datos reales (el más reciente).
        const primeraFecha = ordenadas.find(e => !!e.date)?.date;
        if (primeraFecha) {
          const [y, m, d] = primeraFecha.split('-').map(Number);
          this.selectedDate.set(new Date(y, m - 1, d));
          this.calendarMonth.set(new Date(y, m - 1, 1));
        }

        this.tryInitMap();
      },
      error: () => { this.error = true; this.cargando = false; },
    });
  }

  private seguro<T>(obs: Observable<T[]>): Observable<T[]> {
    return obs.pipe(catchError(() => of([])));
  }

  ngAfterViewInit() {
    this.viewReady = true;
    this.tryInitMap();
    setTimeout(() => this.map?.invalidateSize(), 100);
  }
  private tryInitMap() {
    if (!this.viewReady || this.map) return;
    const history = this.history();
    if (history.length === 0) return;

    const contenedor = this.mapContainer?.nativeElement;
    if (!contenedor) return;

    this.map = L.map(contenedor, { zoomControl: true, scrollWheelZoom: false });
    const mapa = this.map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(mapa);

    history.forEach(e => {
      L.marker([e.lat, e.lng], { icon: markerIcon('#7c3aed') })
        .addTo(mapa)
        .bindPopup(`<b>${e.time}</b><br>${this.descripcion(e)}`);
    });

    const coords: L.LatLngExpression[] = history.map(e => [e.lat, e.lng]);
    const polyline = L.polyline(coords, { color: '#7c3aed', weight: 3, opacity: 0.8 }).addTo(mapa);
    mapa.fitBounds(polyline.getBounds(), { padding: [40, 40] });

    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  flyTo(entry: UbicacionEntry) {
    this.map?.flyTo([entry.lat, entry.lng], 16, { duration: 1 });
  }

  verRecorridoCompleto() {
    this.tipoFiltro.set('todos');
    this.mapContainer?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  ngOnDestroy() { if (this.map) { this.map.remove(); this.map = null; } }
}
