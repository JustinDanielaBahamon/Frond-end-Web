import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import * as L from 'leaflet';

import { AlertsService } from '../../../core/services/alerts.services';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { RiskZonesService, contarAlertasEnZonas, estaDentroDeZona } from '../../../core/services/risk-zones.services';
import { UsersService } from '../../../core/services/users.services';
import { Alerta } from '../../../core/models/alert.model';
import { ZonaManual } from '../../../core/models/zona.model';
import { SelectorFecha } from '../../../shared/components/selector-fecha/selector-fecha';

// Campos extra que vienen en db.json; opcionales para no depender del modelo
type AlertaVM = Alerta & {
  nombre?: string;
  medioActivacion?: string;
  created_at?: string;
  started_at?: string;
};

type Periodo = 'hoy' | '7d' | '30d' | 'custom';
type FiltroEstado = 'Todas' | 'Pendiente' | 'Atendida' | 'Cancelada';

export interface BarraHora {
  hora: number;
  valor: number;
  x: number;
  cx: number;
  y: number;
  h: number;
  pico: boolean;
}

export interface FranjaGraf {
  nombre: string;
  rango: string;
  total: number;
  x: number;
  w: number;
  cx: number;
}

export interface ZonaIncidente {
  rank: number;
  nombre: string;
  direccion: string;
  buscando: boolean;
  zonaRiesgo: string | null;
  cantidad: number;
  porcentaje: number;
  barra: number;
  lat: number;
  lng: number;
}

const CENTRO_POR_DEFECTO: L.LatLngTuple = [2.9273, -75.2819];
const DIA_MS = 86400000;
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DIAS_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

interface BarraDia {
  dia: string;
  diaLargo: string;
  esHoy: boolean;
  xGrupo: number;
  anchoGrupo: number;
  previa: number;
  actual: number | null;
  xPrevia: number;
  yPrevia: number;
  dPrevia: string;
  xActual: number;
  yActual: number;
  dActual: string;
}

/** Barra con las esquinas de arriba redondeadas (4 px) apoyada en la línea base. */
function barraRedondeada(x: number, y: number, ancho: number, base: number): string {
  const alto = base - y;
  if (alto <= 0) return '';
  const r = Math.min(4, alto, ancho / 2);
  return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + ancho - r} Q${x + ancho},${y} ${x + ancho},${y + r} V${base} Z`;
}

/** "3 alertas menos que la semana pasada a esta altura (−50 %)". */
function fraseTendencia(actual: number, previa: number): string {
  if (actual === previa) return actual === 0 ? 'Sin alertas en ninguna de las dos semanas hasta hoy.' : 'Igual que la semana pasada a esta altura.';
  const diff = actual - previa;
  const n = Math.abs(diff);
  const palabra = n === 1 ? 'alerta' : 'alertas';
  const pct = previa > 0 ? ` (${diff > 0 ? '+' : '−'}${Math.round((n / previa) * 100)} %)` : '';
  return `${n} ${palabra} ${diff > 0 ? 'más' : 'menos'} que la semana pasada a esta altura${pct}.`;
}

const FRANJAS = [
  { nombre: 'Madrugada', rango: '0h – 5h', ini: 0, fin: 5 },
  { nombre: 'Mañana', rango: '6h – 11h', ini: 6, fin: 11 },
  { nombre: 'Tarde', rango: '12h – 17h', ini: 12, fin: 17 },
  { nombre: 'Noche', rango: '18h – 23h', ini: 18, fin: 23 },
];

// Geometría del gráfico por hora (coincide con el viewBox 1000x275 del HTML)
const H_X0 = 50;
const H_SLOT = 38.75;
const H_BARRA = 26;
const H_TOP = 40;
const H_BASE = 240;

@Component({
  selector: 'app-dashboard',
  imports: [SelectorFecha, CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class AdminDashboardComponent implements OnInit, OnDestroy {

  private cdr = inject(ChangeDetectorRef);
  private alertsService = inject(AlertsService);
  private riskZonesService = inject(RiskZonesService);
  private usersService = inject(UsersService);
  private geocoding = inject(GeocodingService);

  @ViewChild('mapaZonas') mapaEl?: ElementRef<HTMLDivElement>;

  cargando = true;
  error = false;
  actualizadoEn = new Date();

  // --- Filtros ---
  periodo: Periodo = '7d';
  desde = '';
  hasta = '';
  filtroEstado: FiltroEstado = 'Todas';

  readonly periodos: { valor: Periodo; etiqueta: string }[] = [
    { valor: 'hoy', etiqueta: 'Hoy' },
    { valor: '7d', etiqueta: '7 días' },
    { valor: '30d', etiqueta: '30 días' },
    { valor: 'custom', etiqueta: 'Personalizado' },
  ];

  readonly filtrosEstado: { valor: FiltroEstado; etiqueta: string }[] = [
    { valor: 'Todas', etiqueta: 'Todas' },
    { valor: 'Pendiente', etiqueta: 'Pendientes' },
    { valor: 'Atendida', etiqueta: 'Atendidas' },
    { valor: 'Cancelada', etiqueta: 'Canceladas' },
  ];

  // --- Stat cards ---
  totalUsuarias = 0;
  usuariasActivas = 0;
  porcentajeActivas = 0;
  alertasPendientes = 0;
  pendienteMasAntigua = '';
  alertasAtendidas = 0;
  alertasCanceladas = 0;
  porcentajeAtendidas = 0;
  porcentajeCanceladas = 0;

  // --- Alertas por hora del día ---
  horasBarras: BarraHora[] = [];
  horasTicks: { y: number; label: number }[] = [];
  franjasGraf: FranjaGraf[] = [];
  hayDatosHoras = false;
  horaPicoTexto = '—';
  horaPicoDetalle = 'Sin alertas en este periodo';
  franjaRiesgosaTexto = '—';
  franjaRiesgosaDetalle = 'Sin alertas en este periodo';
  franjaTranquilaTexto = '—';
  franjaTranquilaDetalle = 'Sin alertas en este periodo';

  // --- Zonas con más incidentes ---
  zonasIncidentes: ZonaIncidente[] = [];
  zonaSeleccionada = 0;

  // --- Tendencia (esta semana vs. la anterior) ---
  tendenciaActualTotal = 0;
  tendenciaPreviaTotal = 0;
  tendenciaPreviaHastaHoy = 0;
  tendenciaFrase = '';
  tendenciaTicks: { y: number; label: number }[] = [];
  tendenciaBarras: BarraDia[] = [];

  // --- Tabla ---
  alertasRecientes: AlertaVM[] = [];

  // Datos en memoria (se cargan una sola vez; los filtros no vuelven a llamar al backend)
  private todas: AlertaVM[] = [];
  private zonasApi: ZonaManual[] = [];
  private zonasRiesgo: ZonaManual[] = [];
  private listaPeriodo: AlertaVM[] = [];

  // Mapa
  private mapa?: L.Map;
  private capaPuntos = L.layerGroup();
  private marcadorAlerta?: L.CircleMarker;
  private versionZonas = 0;

  // Geometría del gráfico de tendencia (coincide con el viewBox 640x230 del HTML)
  private readonly graf = { izq: 40, der: 620, arriba: 20, abajo: 190 };

  ngOnInit(): void {
    this.cargarDatos();
  }

  ngOnDestroy(): void {
    this.versionZonas++;
    this.mapa?.remove();
  }

  get zonaActual(): ZonaIncidente | null {
    return this.zonasIncidentes[this.zonaSeleccionada] ?? null;
  }

  private cargarDatos(): void {
    this.cargando = true;
    this.error = false;

    forkJoin({
      alertas: this.alertsService.getAll(),
      zonas: this.riskZonesService.getZonas(),
      usuarios: this.usersService.getAll(),
    }).subscribe({
      next: ({ alertas, zonas: zonasApi, usuarios }) => {
        this.todas = alertas as AlertaVM[];
        this.zonasApi = zonasApi;

        this.totalUsuarias = usuarios.length;
        this.usuariasActivas = usuarios.filter(u => this.estadoDe(u) === 'Activa').length;
        this.porcentajeActivas = this.totalUsuarias
          ? Math.round((this.usuariasActivas / this.totalUsuarias) * 100)
          : 0;

        this.actualizadoEn = new Date();
        this.cargando = false;
        this.recalcular();
      },
      error: (err) => {
        console.error('Error cargando dashboard:', err);
        this.error = true;
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  private estadoDe(u: unknown): string | undefined {
    return (u as { estado?: string }).estado;
  }

  // ── Filtros ────────────────────────────────────────────────────
  setPeriodo(p: Periodo): void {
    this.periodo = p;
    this.recalcular();
  }

  onDesde(valor: string | null): void {
    this.desde = valor ?? '';
    this.recalcular();
  }

  onHasta(valor: string | null): void {
    this.hasta = valor ?? '';
    this.recalcular();
  }

  setFiltroEstado(f: FiltroEstado): void {
    this.filtroEstado = f;
    this.actualizarRecientes();
    this.cdr.detectChanges();
  }

  private fechaDe(a: AlertaVM): Date | null {
    const f = a.created_at ?? a.started_at;
    if (!f) return null;
    const d = new Date(f);
    return isNaN(d.getTime()) ? null : d;
  }

  private rango(): { ini: number; fin: number } {
    const ahora = new Date();
    const hoy0 = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
    switch (this.periodo) {
      case 'hoy': return { ini: hoy0, fin: Infinity };
      case '7d': return { ini: hoy0 - 6 * DIA_MS, fin: Infinity };
      case '30d': return { ini: hoy0 - 29 * DIA_MS, fin: Infinity };
      default:
        return {
          ini: this.desde ? new Date(this.desde + 'T00:00:00').getTime() : -Infinity,
          fin: this.hasta ? new Date(this.hasta + 'T23:59:59.999').getTime() : Infinity,
        };
    }
  }

  private enPeriodo(a: AlertaVM, r: { ini: number; fin: number }): boolean {
    const d = this.fechaDe(a);
    if (!d) return this.periodo === 'custom' && !this.desde && !this.hasta;
    const t = d.getTime();
    return t >= r.ini && t <= r.fin;
  }

  // ── Recalcula todo con el periodo elegido ──────────────────────
  private recalcular(): void {
    const r = this.rango();
    this.listaPeriodo = this.todas.filter(a => this.enPeriodo(a, r));
    this.zonasRiesgo = contarAlertasEnZonas(this.zonasApi, this.listaPeriodo);

    this.calcularKpis(this.listaPeriodo);
    this.calcularHoras(this.listaPeriodo);
    this.calcularZonas(this.listaPeriodo);
    this.calcularTendencia(this.todas);
    this.actualizarRecientes();

    this.marcadorAlerta?.remove();
    this.marcadorAlerta = undefined;

    this.cdr.detectChanges();      // pinta el HTML (y deja listo el contenedor del mapa)
    this.pintarMapa(true);
    void this.resolverLugares(this.versionZonas);
  }

  private pct(parte: number, total: number): number {
    return total ? Math.round((parte / total) * 100) : 0;
  }

  // ── Stat cards ─────────────────────────────────────────────────
  private calcularKpis(lista: AlertaVM[]): void {
    // "Pendientes ahora" ignora el periodo: una alerta sin atender sigue importando aunque sea vieja
    const pendientes = this.todas.filter(a => a.estado === 'Pendiente');
    this.alertasPendientes = pendientes.length;

    let masAntigua: AlertaVM | null = null;
    let menorFecha = Infinity;
    pendientes.forEach(a => {
      const t = this.fechaDe(a)?.getTime();
      if (t !== undefined && t < menorFecha) { menorFecha = t; masAntigua = a; }
    });
    const tiempo = (masAntigua as AlertaVM | null)?.tiempo;
    this.pendienteMasAntigua = tiempo ? `la más antigua: ${tiempo.toLowerCase()}` : 'Sin pendientes';

    this.alertasAtendidas = lista.filter(a => a.estado === 'Atendida').length;
    this.alertasCanceladas = lista.filter(a => a.estado === 'Cancelada').length;
    this.porcentajeAtendidas = this.pct(this.alertasAtendidas, lista.length);
    this.porcentajeCanceladas = this.pct(this.alertasCanceladas, lista.length);
  }

  // ── Alertas por hora del día ───────────────────────────────────
  private calcularHoras(lista: AlertaVM[]): void {
    const conteo = new Array<number>(24).fill(0);
    lista.forEach(a => {
      const d = this.fechaDe(a);
      if (d) conteo[d.getHours()]++;
    });

    const total = conteo.reduce((s, v) => s + v, 0);
    const max = Math.max(...conteo);
    const eje = Math.max(4, Math.ceil(max / 4) * 4);
    const alto = H_BASE - H_TOP;

    this.horasTicks = [0, 1, 2, 3, 4].map(i => {
      const valor = (eje / 4) * i;
      return { y: H_BASE - (valor / eje) * alto, label: valor };
    });

    this.horasBarras = conteo.map((valor, hora) => {
      const h = (valor / eje) * alto;
      const x = H_X0 + hora * H_SLOT + (H_SLOT - H_BARRA) / 2;
      return { hora, valor, x, cx: x + H_BARRA / 2, y: H_BASE - h, h, pico: valor > 0 && valor === max };
    });

    const totales = FRANJAS.map(f => conteo.slice(f.ini, f.fin + 1).reduce((s, v) => s + v, 0));
    this.franjasGraf = FRANJAS.map((f, i) => {
      const x = H_X0 + f.ini * H_SLOT;
      const w = (f.fin - f.ini + 1) * H_SLOT;
      return { nombre: f.nombre, rango: f.rango, total: totales[i], x, w, cx: x + w / 2 };
    });

    this.hayDatosHoras = total > 0;
    if (!total) {
      this.horaPicoTexto = '—';
      this.franjaRiesgosaTexto = '—';
      this.franjaTranquilaTexto = '—';
      this.horaPicoDetalle = this.franjaRiesgosaDetalle = this.franjaTranquilaDetalle = 'Sin alertas en este periodo';
      return;
    }

    const plural = (n: number) => (n === 1 ? 'alerta' : 'alertas');

    // Hora pico
    const picos = conteo.map((v, h) => ({ v, h })).filter(x => x.v === max).map(x => x.h);
    this.horaPicoTexto = picos.slice(0, 3).map(h => `${h}h`).join(', ') + (picos.length > 3 ? '…' : '');
    this.horaPicoDetalle = `${max} ${plural(max)}${picos.length > 1 ? ' en cada hora' : ''}`;

    // Franja más riesgosa
    const maxTot = Math.max(...totales);
    const riesgosas = FRANJAS.filter((_, i) => totales[i] === maxTot);
    this.franjaRiesgosaTexto = riesgosas.length === 1
      ? `${riesgosas[0].nombre} (${riesgosas[0].rango})`
      : riesgosas.map(f => f.nombre).join(' y ');
    this.franjaRiesgosaDetalle = `${maxTot} de ${total} alertas · ${this.pct(maxTot, total)}%`;

    // Franja más tranquila
    const minTot = Math.min(...totales);
    const tranquilas = FRANJAS.filter((_, i) => totales[i] === minTot);
    this.franjaTranquilaTexto = tranquilas.map(f => f.nombre).join(' y ');
    this.franjaTranquilaDetalle = `${minTot} ${plural(minTot)}${tranquilas.length > 1 ? ' en cada una' : ''}`;
  }

  // ── Zonas con más incidentes (agrupa por cercanía ~450 m) ──────
  private calcularZonas(lista: AlertaVM[]): void {
    this.versionZonas++;
    this.zonaSeleccionada = 0;

    const celda = 0.004;
    const grupos = new Map<string, { cantidad: number; lat: number; lng: number }>();

    // Las alertas sin ubicación (0,0) no se pueden ubicar en el mapa
    const conUbicacion = lista.filter(a => a.lat || a.lng);
    conUbicacion.forEach(a => {
      const clave = `${Math.round(Number(a.lat) / celda)}|${Math.round(Number(a.lng) / celda)}`;
      const g = grupos.get(clave) ?? { cantidad: 0, lat: 0, lng: 0 };
      g.cantidad++;
      g.lat += Number(a.lat);
      g.lng += Number(a.lng);
      grupos.set(clave, g);
    });

    const top = [...grupos.values()]
      .map(g => ({ cantidad: g.cantidad, lat: g.lat / g.cantidad, lng: g.lng / g.cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    const maxCant = top.length ? top[0].cantidad : 1;

    this.zonasIncidentes = top.map((z, i) => {
      const zonaRiesgo = this.zonasRiesgo.find(zr => estaDentroDeZona(zr, z.lat, z.lng))?.nombre ?? null;
      return {
        rank: i + 1,
        nombre: zonaRiesgo ?? `${z.lat.toFixed(4)}, ${z.lng.toFixed(4)}`,
        direccion: '',
        buscando: true,
        zonaRiesgo,
        cantidad: z.cantidad,
        porcentaje: this.pct(z.cantidad, conUbicacion.length),
        barra: Math.max(8, Math.round((z.cantidad / maxCant) * 100)),
        lat: z.lat,
        lng: z.lng,
      };
    });
  }

  // Barrio y dirección reales (OpenStreetMap), uno por uno para respetar el límite de Nominatim
  private async resolverLugares(version: number): Promise<void> {
    for (const z of this.zonasIncidentes) {
      const lugar = await this.geocoding.obtener(z.lat, z.lng);
      if (version !== this.versionZonas) return; // cambió el filtro mientras se consultaba

      if (lugar) {
        const nombre = lugar.barrio ?? lugar.direccion ?? lugar.ciudad;
        if (nombre) z.nombre = nombre;
        z.direccion = lugar.barrio
          ? (lugar.direccion ?? '')
          : (lugar.direccion ? (lugar.ciudad ?? '') : '');
      }
      z.buscando = false;
      this.cdr.detectChanges();
      this.pintarMapa(false);
    }
  }

  seleccionarZona(i: number): void {
    const z = this.zonasIncidentes[i];
    if (!z) return;
    this.zonaSeleccionada = i;
    this.pintarMapa(false);
    this.mapa?.flyTo([z.lat, z.lng], 16, { duration: 0.8 });
    this.cdr.detectChanges();
  }

  verEnMapa(a: AlertaVM): void {
    if (!this.mapa || !(a.lat || a.lng)) return;
    this.marcadorAlerta?.remove();
    this.marcadorAlerta = L.circleMarker([a.lat, a.lng], {
      radius: 10, color: '#ffffff', weight: 3, fillColor: '#c026d3', fillOpacity: 1,
    })
      .bindTooltip(`${this.escapar(a.nombre ?? '')} · ${this.escapar(a.tiempo)}`)
      .addTo(this.mapa);
    this.marcadorAlerta.openTooltip();
    this.mapa.flyTo([a.lat, a.lng], 17, { duration: 0.8 });
    this.mapaEl?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private pintarMapa(ajustar: boolean): void {
    const el = this.mapaEl?.nativeElement;
    if (!el) return;

    if (!this.mapa) {
      this.mapa = L.map(el, { center: CENTRO_POR_DEFECTO, zoom: 13 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(this.mapa);
      this.capaPuntos.addTo(this.mapa);
    }

    this.capaPuntos.clearLayers();
    const puntos: L.LatLngTuple[] = [];

    this.zonasIncidentes.forEach((z, i) => {
      const seleccionada = i === this.zonaSeleccionada;
      const color = i === 0 ? '#c026d3' : '#7c3aed';
      puntos.push([z.lat, z.lng]);
      L.circleMarker([z.lat, z.lng], {
        radius: 9 + Math.min(z.cantidad, 10) * 1.5,
        color: seleccionada ? '#ffffff' : color,
        weight: seleccionada ? 3 : 1.5,
        fillColor: color,
        fillOpacity: seleccionada ? 0.95 : 0.55,
      })
        .bindTooltip(`${this.escapar(z.nombre)} · ${z.cantidad}`)
        .on('click', () => this.seleccionarZona(i))
        .addTo(this.capaPuntos);
    });

    setTimeout(() => this.mapa?.invalidateSize(), 0);

    if (ajustar && puntos.length) {
      if (puntos.length === 1) this.mapa.setView(puntos[0], 15);
      else this.mapa.fitBounds(L.latLngBounds(puntos).pad(0.25));
    }
  }

  private escapar(texto: string): string {
    return texto.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  }

  // ── Tendencia: esta semana vs. la anterior ─────────────────────
  private calcularTendencia(lista: AlertaVM[]): void {
    const ahora = new Date();
    const hoy0 = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
    const diaHoy = (ahora.getDay() + 6) % 7; // lunes = 0
    const lunes = hoy0 - diaHoy * DIA_MS;
    const lunesPrevio = lunes - 7 * DIA_MS;

    const actual = new Array<number>(7).fill(0);
    const previa = new Array<number>(7).fill(0);

    lista.forEach(a => {
      const d = this.fechaDe(a);
      if (!d) return;
      const t = d.getTime();
      const dia = (d.getDay() + 6) % 7;
      if (t >= lunes && t < lunes + 7 * DIA_MS) actual[dia]++;
      else if (t >= lunesPrevio && t < lunes) previa[dia]++;
    });

    this.tendenciaActualTotal = actual.reduce((s, v) => s + v, 0);
    this.tendenciaPreviaTotal = previa.reduce((s, v) => s + v, 0);

    // Comparación justa: la semana pasada solo hasta el mismo día de hoy
    this.tendenciaPreviaHastaHoy = previa.slice(0, diaHoy + 1).reduce((s, v) => s + v, 0);
    this.tendenciaFrase = fraseTendencia(this.tendenciaActualTotal, this.tendenciaPreviaHastaHoy);

    const { izq, der, arriba, abajo } = this.graf;
    const maximo = Math.max(...actual, ...previa, 1);
    const escala = Math.max(4, Math.ceil(maximo / 4) * 4);
    const yDe = (v: number) => abajo - (v / Math.max(escala, 1)) * (abajo - arriba);

    this.tendenciaTicks = [0, 1, 2, 3, 4].map(i => {
      const valor = (escala / 4) * i;
      return { y: yDe(valor), label: valor };
    });

    const anchoGrupo = (der - izq) / 7;
    const ancho = 22;
    this.tendenciaBarras = DIAS_SEMANA.map((dia, i) => {
      const xGrupo = izq + i * anchoGrupo;
      const xPrevia = xGrupo + anchoGrupo / 2 - ancho - 1;
      const xActual = xGrupo + anchoGrupo / 2 + 1;
      // Los días que aún no llegan no son "cero alertas": no se dibujan
      const valorActual = i <= diaHoy ? actual[i] : null;
      return {
        dia,
        diaLargo: DIAS_LARGOS[i],
        esHoy: i === diaHoy,
        xGrupo,
        anchoGrupo,
        previa: previa[i],
        actual: valorActual,
        xPrevia,
        yPrevia: yDe(previa[i]),
        dPrevia: barraRedondeada(xPrevia, yDe(previa[i]), ancho, abajo),
        xActual,
        yActual: yDe(valorActual ?? 0),
        dActual: barraRedondeada(xActual, yDe(valorActual ?? 0), ancho, abajo),
      };
    });
  }

  // ── Tabla de alertas recientes ─────────────────────────────────
  private actualizarRecientes(): void {
    // El backend las envía de la más reciente a la más antigua
    const base = this.filtroEstado === 'Todas'
      ? this.listaPeriodo
      : this.listaPeriodo.filter(a => a.estado === this.filtroEstado);
    this.alertasRecientes = base.slice(0, 5);
  }

  claseEstado(estado: string): string {
    if (estado === 'Atendida') return 'estado-badge--atendida';
    if (estado === 'Cancelada') return 'estado-badge--cancelada';
    return 'estado-badge--pendiente';
  }
}