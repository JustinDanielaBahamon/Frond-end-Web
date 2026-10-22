import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import * as L from 'leaflet';

import { AlertsService } from '../../../core/services/alerts.services';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { RiskZonesService, countAlertsInZones, isInsideZone } from '../../../core/services/risk-zones.services';
import { UsersService } from '../../../core/services/users.services';
import { Alert } from '../../../core/models/alert.model';
import { ManualZone } from '../../../core/models/zona.model';
import { DatePicker } from '../../../shared/components/selector-fecha/selector-fecha';

// Campos extra que vienen en db.json; opcionales para no depender del modelo
type AlertVM = Alert & {
  name?: string;
  activationMethod?: string;
  created_at?: string;
  started_at?: string;
};

type Period = 'hoy' | '7d' | '30d' | 'custom';
type StatusFilter = 'Todas' | 'Pendiente' | 'Atendida' | 'Cancelada';

export interface HourBar {
  time: number;
  value: number;
  x: number;
  cx: number;
  y: number;
  h: number;
  peak: boolean;
}

export interface ChartBand {
  name: string;
  range: string;
  total: number;
  x: number;
  w: number;
  cx: number;
}

export interface IncidentZone {
  rank: number;
  name: string;
  address: string;
  searching: boolean;
  riskZone: string | null;
  count: number;
  percentage: number;
  bar: number;
  lat: number;
  lng: number;
}

const DEFAULT_CENTER: L.LatLngTuple = [2.9273, -75.2819];
const DAY_MS = 86400000;
const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const LONG_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

type TrendView = 'semana' | 'mes';

interface DayBar {
  day: string;
  longDay: string;
  isToday: boolean;
  groupX: number;
  groupWidth: number;
  previous: number;
  current: number | null;
  previousX: number;
  previousY: number;
  previousPath: string;
  currentX: number;
  currentY: number;
  currentPath: string;
  barWidth: number;
}

/** Barra con las esquinas de arriba redondeadas (4 px) apoyada en la línea base. */
function roundedBar(x: number, y: number, width: number, base: number): string {
  const height = base - y;
  if (height <= 0) return '';
  const r = Math.min(4, height, width / 2);
  return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${base} Z`;
}

/** "3 alertas menos que la semana pasada a esta altura (−50 %)". */
function trendSentence(current: number, previousCount: number, view: TrendView = 'semana'): string {
  const previousLabel = view === 'mes' ? 'el mes pasado' : 'la semana pasada';
  if (current === previousCount) {
    if (current === 0) return view === 'mes' ? 'Sin alertas en ninguno de los dos meses hasta hoy.' : 'Sin alertas en ninguna de las dos semanas hasta hoy.';
    return `Igual que ${previousLabel} a esta altura.`;
  }
  const diff = current - previousCount;
  const n = Math.abs(diff);
  const word = n === 1 ? 'alerta' : 'alertas';
  const pct = previousCount > 0 ? ` (${diff > 0 ? '+' : '−'}${Math.round((n / previousCount) * 100)} %)` : '';
  return `${n} ${word} ${diff > 0 ? 'más' : 'menos'} que ${previousLabel} a esta altura${pct}.`;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const TIME_BANDS = [
  { name: 'Madrugada', range: '0h – 5h', start: 0, end: 5 },
  { name: 'Mañana', range: '6h – 11h', start: 6, end: 11 },
  { name: 'Tarde', range: '12h – 17h', start: 12, end: 17 },
  { name: 'Noche', range: '18h – 23h', start: 18, end: 23 },
];

// Geometría del gráfico por hora (coincide con el viewBox 1000x275 del HTML)
const H_X0 = 50;
const H_SLOT = 38.75;
const BAR_H = 26;
const H_TOP = 40;
const H_BASE = 240;

@Component({
  selector: 'app-dashboard',
  imports: [DatePicker, CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class AdminDashboardComponent implements OnInit, OnDestroy {

  private cdr = inject(ChangeDetectorRef);
  private alertsService = inject(AlertsService);
  private riskZonesService = inject(RiskZonesService);
  private usersService = inject(UsersService);
  private geocoding = inject(GeocodingService);

  @ViewChild('mapaZonas') mapEl?: ElementRef<HTMLDivElement>;

  loading = true;
  error = false;
  updatedAt = new Date();

  // --- Filtros ---
  period: Period = '7d';
  from = '';
  to = '';
  statusFilter: StatusFilter = 'Todas';

  readonly periods: { value: Period; label: string }[] = [
    { value: 'hoy', label: 'Hoy' },
    { value: '7d', label: '7 días' },
    { value: '30d', label: '30 días' },
    { value: 'custom', label: 'Personalizado' },
  ];

  readonly statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'Todas', label: 'Todas' },
    { value: 'Pendiente', label: 'Pendientes' },
    { value: 'Atendida', label: 'Atendidas' },
    { value: 'Cancelada', label: 'Canceladas' },
  ];

  // --- Stat cards ---
  totalUsers = 0;
  activeUsers = 0;
  activePercentage = 0;
  pendingAlerts = 0;
  oldestPending = '';
  attendedAlerts = 0;
  cancelledAlerts = 0;
  attendedPercentage = 0;
  cancelledPercentage = 0;

  // --- Alertas por hora del día ---
  hourBars: HourBar[] = [];
  hourTicks: { y: number; label: number }[] = [];
  chartBands: ChartBand[] = [];
  hasHourData = false;
  peakHourText = '—';
  peakHourDetail = 'Sin alertas en este periodo';
  riskyBandText = '—';
  riskyBandDetail = 'Sin alertas en este periodo';
  calmBandText = '—';
  calmBandDetail = 'Sin alertas en este periodo';

  // --- Zonas con más incidentes ---
  incidentZones: IncidentZone[] = [];
  selectedZone = 0;

  // --- Tendencia (esta semana vs. la anterior, o este mes por semanas vs. el anterior) ---
  trendView: TrendView = 'semana';
  monthTrend = '';
  currentTrendTotal = 0;
  previousTrendTotal = 0;
  previousTrendUntilToday = 0;
  trendSentence = '';
  trendTicks: { y: number; label: number }[] = [];
  trendBars: DayBar[] = [];

  // --- Tabla ---
  recentAlerts: AlertVM[] = [];

  // Datos en memoria (se cargan una sola vez; los filtros no vuelven a llamar al backend)
  private all: AlertVM[] = [];
  private apiZones: ManualZone[] = [];
  private riskZones: ManualZone[] = [];
  private periodList: AlertVM[] = [];

  // Mapa
  private map?: L.Map;
  private pointsLayer = L.layerGroup();
  private alertMarker?: L.CircleMarker;
  private zonesVersion = 0;

  // Geometría del gráfico de tendencia (coincide con el viewBox 640x230 del HTML)
  private readonly chart = { left: 40, right: 620, up: 20, down: 190 };

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.zonesVersion++;
    this.map?.remove();
  }

  get currentZone(): IncidentZone | null {
    return this.incidentZones[this.selectedZone] ?? null;
  }

  private loadData(): void {
    this.loading = true;
    this.error = false;

    forkJoin({
      alerts: this.alertsService.getAll(),
      zones: this.riskZonesService.getZones(),
      users: this.usersService.getAll(),
    }).subscribe({
      next: ({ alerts, zones: apiZones, users }) => {
        this.all = alerts as AlertVM[];
        this.apiZones = apiZones;

        this.totalUsers = users.length;
        this.activeUsers = users.filter(u => this.statusOf(u) === 'Activa').length;
        this.activePercentage = this.totalUsers
          ? Math.round((this.activeUsers / this.totalUsers) * 100)
          : 0;

        this.updatedAt = new Date();
        this.loading = false;
        this.recompute();
      },
      error: (err) => {
        console.error('Error cargando dashboard:', err);
        this.error = true;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private statusOf(u: unknown): string | undefined {
    return (u as { status?: string }).status;
  }

  // ── Filtros ────────────────────────────────────────────────────
  setPeriod(p: Period): void {
    this.period = p;
    this.recompute();
  }

  onFrom(value: string | null): void {
    this.from = value ?? '';
    this.recompute();
  }

  onTo(value: string | null): void {
    this.to = value ?? '';
    this.recompute();
  }

  setStatusFilter(f: StatusFilter): void {
    this.statusFilter = f;
    this.updateRecent();
    this.cdr.detectChanges();
  }

  private dateOf(a: AlertVM): Date | null {
    const f = a.created_at ?? a.started_at;
    if (!f) return null;
    const d = new Date(f);
    return isNaN(d.getTime()) ? null : d;
  }

  private range(): { start: number; end: number } {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    switch (this.period) {
      case 'hoy': return { start: todayStart, end: Infinity };
      case '7d': return { start: todayStart - 6 * DAY_MS, end: Infinity };
      case '30d': return { start: todayStart - 29 * DAY_MS, end: Infinity };
      default:
        return {
          start: this.from ? new Date(this.from + 'T00:00:00').getTime() : -Infinity,
          end: this.to ? new Date(this.to + 'T23:59:59.999').getTime() : Infinity,
        };
    }
  }

  private inPeriod(a: AlertVM, r: { start: number; end: number }): boolean {
    const d = this.dateOf(a);
    if (!d) return this.period === 'custom' && !this.from && !this.to;
    const t = d.getTime();
    return t >= r.start && t <= r.end;
  }

  // ── Recalcula todo con el periodo elegido ──────────────────────
  private recompute(): void {
    const r = this.range();
    this.periodList = this.all.filter(a => this.inPeriod(a, r));
    this.riskZones = countAlertsInZones(this.apiZones, this.periodList);

    this.computeKpis(this.periodList);
    this.computeHours(this.periodList);
    this.computeZones(this.periodList);
    this.computeTrend(this.all);
    this.updateRecent();

    this.alertMarker?.remove();
    this.alertMarker = undefined;

    this.cdr.detectChanges();      // pinta el HTML (y deja listo el contenedor del mapa)
    this.paintMap(true);
    void this.resolvePlaces(this.zonesVersion);
  }

  private pct(part: number, total: number): number {
    return total ? Math.round((part / total) * 100) : 0;
  }

  // ── Stat cards ─────────────────────────────────────────────────
  private computeKpis(list: AlertVM[]): void {
    // "Pendientes ahora" ignora el periodo: una alerta sin atender sigue importando aunque sea vieja
    const pending = this.all.filter(a => a.status === 'Pendiente');
    this.pendingAlerts = pending.length;

    let masAntigua: AlertVM | null = null;
    let earliestDate = Infinity;
    pending.forEach(a => {
      const t = this.dateOf(a)?.getTime();
      if (t !== undefined && t < earliestDate) { earliestDate = t; masAntigua = a; }
    });
    const time = (masAntigua as AlertVM | null)?.time;
    this.oldestPending = time ? `la más antigua: ${time.toLowerCase()}` : 'Sin pendientes';

    this.attendedAlerts = list.filter(a => a.status === 'Atendida').length;
    this.cancelledAlerts = list.filter(a => a.status === 'Cancelada').length;
    this.attendedPercentage = this.pct(this.attendedAlerts, list.length);
    this.cancelledPercentage = this.pct(this.cancelledAlerts, list.length);
  }

  // ── Alertas por hora del día ───────────────────────────────────
  private computeHours(list: AlertVM[]): void {
    const count = new Array<number>(24).fill(0);
    list.forEach(a => {
      const d = this.dateOf(a);
      if (d) count[d.getHours()]++;
    });

    const total = count.reduce((s, v) => s + v, 0);
    const max = Math.max(...count);
    const axis = Math.max(4, Math.ceil(max / 4) * 4);
    const height = H_BASE - H_TOP;

    this.hourTicks = [0, 1, 2, 3, 4].map(i => {
      const value = (axis / 4) * i;
      return { y: H_BASE - (value / axis) * height, label: value };
    });

    this.hourBars = count.map((value, time) => {
      const h = (value / axis) * height;
      const x = H_X0 + time * H_SLOT + (H_SLOT - BAR_H) / 2;
      return { time, value, x, cx: x + BAR_H / 2, y: H_BASE - h, h, peak: value > 0 && value === max };
    });

    const totals = TIME_BANDS.map(f => count.slice(f.start, f.end + 1).reduce((s, v) => s + v, 0));
    this.chartBands = TIME_BANDS.map((f, i) => {
      const x = H_X0 + f.start * H_SLOT;
      const w = (f.end - f.start + 1) * H_SLOT;
      return { name: f.name, range: f.range, total: totals[i], x, w, cx: x + w / 2 };
    });

    this.hasHourData = total > 0;
    if (!total) {
      this.peakHourText = '—';
      this.riskyBandText = '—';
      this.calmBandText = '—';
      this.peakHourDetail = this.riskyBandDetail = this.calmBandDetail = 'Sin alertas en este periodo';
      return;
    }

    const plural = (n: number) => (n === 1 ? 'alerta' : 'alertas');

    // Hora pico
    const peaks = count.map((v, h) => ({ v, h })).filter(x => x.v === max).map(x => x.h);
    this.peakHourText = peaks.slice(0, 3).map(h => `${h}h`).join(', ') + (peaks.length > 3 ? '…' : '');
    this.peakHourDetail = `${max} ${plural(max)}${peaks.length > 1 ? ' en cada hora' : ''}`;

    // Franja más riesgosa
    const maxTot = Math.max(...totals);
    const risky = TIME_BANDS.filter((_, i) => totals[i] === maxTot);
    this.riskyBandText = risky.length === 1
      ? `${risky[0].name} (${risky[0].range})`
      : risky.map(f => f.name).join(' y ');
    this.riskyBandDetail = `${maxTot} de ${total} alertas · ${this.pct(maxTot, total)}%`;

    // Franja más tranquila
    const minTot = Math.min(...totals);
    const calm = TIME_BANDS.filter((_, i) => totals[i] === minTot);
    this.calmBandText = calm.map(f => f.name).join(' y ');
    this.calmBandDetail = `${minTot} ${plural(minTot)}${calm.length > 1 ? ' en cada una' : ''}`;
  }

  // ── Zonas con más incidentes (agrupa por cercanía ~450 m) ──────
  private computeZones(list: AlertVM[]): void {
    this.zonesVersion++;
    this.selectedZone = 0;

    const cell = 0.004;
    const groups = new Map<string, { count: number; lat: number; lng: number }>();

    // Las alertas sin ubicación (0,0) no se pueden ubicar en el mapa
    const withLocation = list.filter(a => a.lat || a.lng);
    withLocation.forEach(a => {
      const key = `${Math.round(Number(a.lat) / cell)}|${Math.round(Number(a.lng) / cell)}`;
      const g = groups.get(key) ?? { count: 0, lat: 0, lng: 0 };
      g.count++;
      g.lat += Number(a.lat);
      g.lng += Number(a.lng);
      groups.set(key, g);
    });

    const top = [...groups.values()]
      .map(g => ({ count: g.count, lat: g.lat / g.count, lng: g.lng / g.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const maxCount = top.length ? top[0].count : 1;

    this.incidentZones = top.map((z, i) => {
      const riskZone = this.riskZones.find(zr => isInsideZone(zr, z.lat, z.lng))?.name ?? null;
      return {
        rank: i + 1,
        name: riskZone ?? `${z.lat.toFixed(4)}, ${z.lng.toFixed(4)}`,
        address: '',
        searching: true,
        riskZone,
        count: z.count,
        percentage: this.pct(z.count, withLocation.length),
        bar: Math.max(8, Math.round((z.count / maxCount) * 100)),
        lat: z.lat,
        lng: z.lng,
      };
    });
  }

  // Barrio y dirección reales (OpenStreetMap), uno por uno para respetar el límite de Nominatim
  private async resolvePlaces(version: number): Promise<void> {
    for (const z of this.incidentZones) {
      const place = await this.geocoding.get(z.lat, z.lng);
      if (version !== this.zonesVersion) return; // cambió el filtro mientras se consultaba

      if (place) {
        const name = place.neighborhood ?? place.address ?? place.city;
        if (name) z.name = name;
        z.address = place.neighborhood
          ? (place.address ?? '')
          : (place.address ? (place.city ?? '') : '');
      }
      z.searching = false;
      this.cdr.detectChanges();
      this.paintMap(false);
    }
  }

  selectZone(i: number): void {
    const z = this.incidentZones[i];
    if (!z) return;
    this.selectedZone = i;
    this.paintMap(false);
    this.map?.flyTo([z.lat, z.lng], 16, { duration: 0.8 });
    this.cdr.detectChanges();
  }

  viewOnMap(a: AlertVM): void {
    if (!this.map || !(a.lat || a.lng)) return;
    this.alertMarker?.remove();
    this.alertMarker = L.circleMarker([a.lat, a.lng], {
      radius: 10, color: '#ffffff', weight: 3, fillColor: '#c026d3', fillOpacity: 1,
    })
      .bindTooltip(`${this.escape(a.name ?? '')} · ${this.escape(a.time)}`)
      .addTo(this.map);
    this.alertMarker.openTooltip();
    this.map.flyTo([a.lat, a.lng], 17, { duration: 0.8 });
    this.mapEl?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private paintMap(adjust: boolean): void {
    const el = this.mapEl?.nativeElement;
    if (!el) return;

    if (!this.map) {
      this.map = L.map(el, { center: DEFAULT_CENTER, zoom: 13 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(this.map);
      this.pointsLayer.addTo(this.map);
    }

    this.pointsLayer.clearLayers();
    const points: L.LatLngTuple[] = [];

    this.incidentZones.forEach((z, i) => {
      const selected = i === this.selectedZone;
      const color = i === 0 ? '#c026d3' : '#7c3aed';
      points.push([z.lat, z.lng]);
      L.circleMarker([z.lat, z.lng], {
        radius: 9 + Math.min(z.count, 10) * 1.5,
        color: selected ? '#ffffff' : color,
        weight: selected ? 3 : 1.5,
        fillColor: color,
        fillOpacity: selected ? 0.95 : 0.55,
      })
        .bindTooltip(`${this.escape(z.name)} · ${z.count}`)
        .on('click', () => this.selectZone(i))
        .addTo(this.pointsLayer);
    });

    setTimeout(() => this.map?.invalidateSize(), 0);

    if (adjust && points.length) {
      if (points.length === 1) this.map.setView(points[0], 15);
      else this.map.fitBounds(L.latLngBounds(points).pad(0.25));
    }
  }

  private escape(text: string): string {
    return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  }

  changeTrendView(view: TrendView): void {
    if (view === this.trendView) return;
    this.trendView = view;
    this.computeTrend(this.all);
  }

  // ── Tendencia: esta semana vs. la anterior ─────────────────────
  private computeTrend(list: AlertVM[]): void {
    if (this.trendView === 'mes') {
      this.computeMonthTrend(list);
      return;
    }
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const today = (now.getDay() + 6) % 7; // lunes = 0
    const monday = todayStart - today * DAY_MS;
    const previousMonday = monday - 7 * DAY_MS;

    const current = new Array<number>(7).fill(0);
    const previous = new Array<number>(7).fill(0);

    list.forEach(a => {
      const d = this.dateOf(a);
      if (!d) return;
      const t = d.getTime();
      const day = (d.getDay() + 6) % 7;
      if (t >= monday && t < monday + 7 * DAY_MS) current[day]++;
      else if (t >= previousMonday && t < monday) previous[day]++;
    });

    this.currentTrendTotal = current.reduce((s, v) => s + v, 0);
    this.previousTrendTotal = previous.reduce((s, v) => s + v, 0);

    // Comparación justa: la semana pasada solo hasta el mismo día de hoy
    this.previousTrendUntilToday = previous.slice(0, today + 1).reduce((s, v) => s + v, 0);
    this.trendSentence = trendSentence(this.currentTrendTotal, this.previousTrendUntilToday);

    this.drawTrend(
      current.map((v, i) => (i <= today ? v : null)),
      previous,
      WEEK_DAYS,
      LONG_DAYS,
      today,
      22,
    );
  }

  /**
   * Este mes por semanas (días 1–7, 8–14, 15–21, 22–28 y 29 en adelante) contra las mismas semanas
   * del mes anterior. Así se ve en qué parte del mes se concentran las alertas.
   */
  private computeMonthTrend(list: AlertVM[]): void {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthDays = new Date(year, month + 1, 0).getDate();
    const previousMonthDays = new Date(year, month, 0).getDate();
    const weeks = Math.max(Math.ceil(monthDays / 7), Math.ceil(previousMonthDays / 7));
    const currentWeek = Math.floor((now.getDate() - 1) / 7);
    const monthStart = new Date(year, month, 1).getTime();
    const previousStart = new Date(year, month - 1, 1).getTime();
    const monthEnd = new Date(year, month + 1, 1).getTime();

    const current = new Array<number>(weeks).fill(0);
    const previous = new Array<number>(weeks).fill(0);
    let previousUntilToday = 0;

    list.forEach(a => {
      const d = this.dateOf(a);
      if (!d) return;
      const t = d.getTime();
      const week = Math.floor((d.getDate() - 1) / 7);
      if (t >= monthStart && t < monthEnd) current[week]++;
      else if (t >= previousStart && t < monthStart) {
        previous[week]++;
        // Comparación justa: el mes pasado solo hasta el mismo día del mes
        if (d.getDate() <= now.getDate()) previousUntilToday++;
      }
    });

    this.monthTrend = MONTHS[month];
    this.currentTrendTotal = current.reduce((s, v) => s + v, 0);
    this.previousTrendTotal = previous.reduce((s, v) => s + v, 0);
    this.previousTrendUntilToday = previousUntilToday;
    this.trendSentence = trendSentence(this.currentTrendTotal, previousUntilToday, 'mes');

    const range = (i: number) => {
      const start = i * 7 + 1;
      const end = Math.min(start + 6, Math.max(monthDays, previousMonthDays));
      return `días ${start} al ${i === weeks - 1 ? 'fin de mes' : end}`;
    };
    this.drawTrend(
      // Las semanas que aún no llegan (o que este mes no tiene) no se dibujan
      current.map((v, i) => (i <= currentWeek && i * 7 < monthDays ? v : null)),
      previous,
      current.map((_, i) => `Sem ${i + 1}`),
      current.map((_, i) => `Semana ${i + 1} (${range(i)})`),
      currentWeek,
      34,
    );
  }

  private drawTrend(
    current: (number | null)[],
    previous: number[],
    labels: string[],
    longLabels: string[],
    todayIndex: number,
    width: number,
  ): void {
    const { left, right, up, down } = this.chart;
    const max = Math.max(...current.map(v => v ?? 0), ...previous, 1);
    const scale = Math.max(4, Math.ceil(max / 4) * 4);
    const yOf = (v: number) => down - (v / Math.max(scale, 1)) * (down - up);

    this.trendTicks = [0, 1, 2, 3, 4].map(i => {
      const value = (scale / 4) * i;
      return { y: yOf(value), label: value };
    });

    const groupWidth = (right - left) / labels.length;
    this.trendBars = labels.map((day, i) => {
      const groupX = left + i * groupWidth;
      const previousX = groupX + groupWidth / 2 - width - 1;
      const currentX = groupX + groupWidth / 2 + 1;
      // Los días que aún no llegan no son "cero alertas": no se dibujan
      const currentValue = current[i];
      return {
        day,
        longDay: longLabels[i],
        isToday: i === todayIndex,
        groupX,
        groupWidth,
        previous: previous[i],
        current: currentValue,
        previousX,
        previousY: yOf(previous[i]),
        previousPath: roundedBar(previousX, yOf(previous[i]), width, down),
        currentX,
        currentY: yOf(currentValue ?? 0),
        currentPath: roundedBar(currentX, yOf(currentValue ?? 0), width, down),
        barWidth: width,
      };
    });
  }

  // ── Tabla de alertas recientes ─────────────────────────────────
  private updateRecent(): void {
    // El backend las envía de la más reciente a la más antigua
    const base = this.statusFilter === 'Todas'
      ? this.periodList
      : this.periodList.filter(a => a.status === this.statusFilter);
    this.recentAlerts = base.slice(0, 5);
  }

  statusClass(status: string): string {
    if (status === 'Atendida') return 'estado-badge--atendida';
    if (status === 'Cancelada') return 'estado-badge--cancelada';
    return 'estado-badge--pendiente';
  }
}