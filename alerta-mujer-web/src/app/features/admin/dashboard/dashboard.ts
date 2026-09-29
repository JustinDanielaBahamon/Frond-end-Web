import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';

import { AlertsService } from '../../../core/services/alerts.services';
import { RiskZonesService } from '../../../core/services/risk-zones.services';
import { UsersService } from '../../../core/services/users.services';
import { Alerta } from '../../../core/models/alert.model';
import { ZonaManual } from '../../../core/models/zona.model';

// Campos extra que vienen en db.json; opcionales para no depender del modelo
type AlertaVM = Alerta & {
  nombre?: string;
  medioActivacion?: string;
  created_at?: string;
  started_at?: string;
};

export interface AlertaPorTipo {
  tipo: string;
  etiqueta: string;
  cantidad: number;
  porcentaje: number;
  color: string;
}

export interface DonutSegmento {
  tipo: string;
  d: string;
  color: string;
}

export interface ModoActivacion {
  nombre: string;
  cantidad: number;
  porcentaje: number;
  color: string;
  icono: 'campana' | 'movimiento' | 'voz' | 'auto';
}

export interface RankingZona {
  nombre: string;
  cantidad: number;
}

export interface BurbujaZona {
  nombre: string;
  cantidad: number;
  x: number;
  y: number;
  r: number;
}

const COLOR_POR_TIPO: Record<string, string> = {
  SOS: '#e11d48',
  Acoso: '#7c3aed',
  Robo: '#2563eb',
  Medical: '#0d9488',
};
const COLOR_OTROS = '#f59e0b';

const ETIQUETA_POR_TIPO: Record<string, string> = {
  SOS: 'SOS',
  Acoso: 'Acoso',
  Robo: 'Robo',
  Medical: 'Emergencia médica',
};

const COLORES_MODO = ['#e11d48', '#7c3aed', '#2563eb', '#0d9488', '#f59e0b'];
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class AdminDashboardComponent implements OnInit {

  private alertsService = inject(AlertsService);
  private riskZonesService = inject(RiskZonesService);
  private usersService = inject(UsersService);

  cargando = true;
  error = false;

  // --- Stat cards ---
  totalUsuarias = 0;
  usuariasActivas = 0;
  porcentajeActivas = 0;
  totalAlertas = 0;
  alertasActivas = 0;
  zonasCriticas = 0;
  alertasEnZonas = 0;

  // --- Tendencia (alertas por día de la semana) ---
  tendenciaTotal = 0;
  tendenciaTicks: { y: number; label: number }[] = [];
  tendenciaLabels: { x: number; texto: string }[] = [];
  tendenciaDots: { x: number; y: number; valor: number }[] = [];
  tendenciaLinea = '';
  tendenciaArea = '';

  // --- Modos de activación ---
  modosActivacion: ModoActivacion[] = [];

  // --- Alertas por zona ---
  rankingZonas: RankingZona[] = [];
  burbujasZona: BurbujaZona[] = [];

  // --- Emergencias por tipo ---
  alertasPorTipo: AlertaPorTipo[] = [];
  donutSegs: DonutSegmento[] = [];

  // --- Tabla ---
  alertasRecientes: AlertaVM[] = [];

  // Geometría del gráfico de tendencia (coincide con el viewBox 640x230 del HTML)
  private readonly graf = { izq: 40, der: 620, arriba: 20, abajo: 190 };

  ngOnInit(): void {
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.cargando = true;
    this.error = false;

    forkJoin({
      alertas: this.alertsService.getAll(),
      zonas: this.riskZonesService.getZonas(),
      usuarios: this.usersService.getAll(),
    }).subscribe({
      next: ({ alertas, zonas, usuarios }) => {
        const lista = alertas as AlertaVM[];

        this.totalUsuarias = usuarios.length;
        this.usuariasActivas = usuarios.filter(u => this.estadoDe(u) === 'Activa').length;
        this.porcentajeActivas = this.totalUsuarias
          ? Math.round((this.usuariasActivas / this.totalUsuarias) * 100)
          : 0;

        this.totalAlertas = lista.length;
        this.alertasActivas = lista.filter(a => a.estado === 'Pendiente').length;
        this.zonasCriticas = zonas.length;
        this.alertasEnZonas = zonas.reduce((suma: number, z: ZonaManual) => suma + z.alertasEnZona, 0);

        this.alertasPorTipo = this.calcularAlertasPorTipo(lista);
        this.donutSegs = this.calcularDonut();
        this.modosActivacion = this.calcularModos(lista);
        this.calcularZonas(lista);
        this.calcularTendencia(lista);

        this.alertasRecientes = lista.slice(-5).reverse();

        this.cargando = false;
      },
      error: (err) => {
        console.error('Error cargando dashboard:', err);
        this.error = true;
        this.cargando = false;
      }
    });
  }

  // ── Helpers de agregación ──────────────────────────────────────
  private contarPor<T>(items: T[], obtenerClave: (item: T) => string): { clave: string; cantidad: number }[] {
    const conteo: Record<string, number> = {};
    items.forEach(item => {
      const clave = obtenerClave(item);
      conteo[clave] = (conteo[clave] ?? 0) + 1;
    });
    return Object.entries(conteo).map(([clave, cantidad]) => ({ clave, cantidad }));
  }

  private estadoDe(u: unknown): string | undefined {
    return (u as { estado?: string }).estado;
  }

  // ── Emergencias por tipo ───────────────────────────────────────
  private calcularAlertasPorTipo(lista: AlertaVM[]): AlertaPorTipo[] {
    const total = lista.length || 1;
    return this.contarPor(lista, a => a.tipo)
      .sort((a, b) => b.cantidad - a.cantidad)
      .map(({ clave, cantidad }) => ({
        tipo: clave,
        etiqueta: this.etiquetaTipo(clave),
        cantidad,
        porcentaje: Math.round((cantidad / total) * 100),
        color: this.colorTipo(clave),
      }));
  }

  private calcularDonut(): DonutSegmento[] {
    const r = 60, cx = 80, cy = 80;
    const total = this.totalAlertas || 1;
    let inicio = -90;

    return this.alertasPorTipo.map(item => {
      const angulo = (item.cantidad / total) * 360;
      const fin = inicio + angulo;
      let d: string;

      if (angulo >= 359.99) {
        // un solo tipo = círculo completo (un arco de 360° no se dibuja)
        d = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
      } else {
        const grande = angulo > 180 ? 1 : 0;
        const x1 = cx + r * Math.cos((inicio * Math.PI) / 180);
        const y1 = cy + r * Math.sin((inicio * Math.PI) / 180);
        const x2 = cx + r * Math.cos((fin * Math.PI) / 180);
        const y2 = cy + r * Math.sin((fin * Math.PI) / 180);
        d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${grande} 1 ${x2} ${y2} Z`;
      }

      inicio = fin;
      return { tipo: item.tipo, d, color: item.color };
    });
  }

  etiquetaTipo(tipo: string): string {
    return ETIQUETA_POR_TIPO[tipo] ?? tipo;
  }

  colorTipo(tipo: string): string {
    return COLOR_POR_TIPO[tipo] ?? COLOR_OTROS;
  }

  getTipoBadgeClass(tipo: string): string {
    const map: Record<string, string> = {
      SOS: 'badge-sos',
      Medical: 'badge-medica',
      Robo: 'badge-robo',
      Acoso: 'badge-acoso',
    };
    return map[tipo] ?? 'badge-otros';
  }

  // ── Modos de activación ────────────────────────────────────────
  private calcularModos(lista: AlertaVM[]): ModoActivacion[] {
    const total = lista.length || 1;
    return this.contarPor(lista, a => a.medioActivacion || 'Sin especificar')
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5)
      .map(({ clave, cantidad }, i) => ({
        nombre: clave,
        cantidad,
        porcentaje: Math.round((cantidad / total) * 100),
        color: COLORES_MODO[i % COLORES_MODO.length],
        icono: this.iconoModo(clave),
      }));
  }

  private iconoModo(nombre: string): ModoActivacion['icono'] {
    const n = nombre.toLowerCase();
    if (n.includes('bot') || n.includes('pan')) return 'campana';
    if (n.includes('mov') || n.includes('sacud') || n.includes('agit')) return 'movimiento';
    if (n.includes('voz')) return 'voz';
    return 'auto';
  }

  // ── Alertas por zona (mapa esquemático con lat/lng reales) ─────
  private calcularZonas(lista: AlertaVM[]): void {
    const grupos = new Map<string, { cantidad: number; lat: number; lng: number }>();

    lista.forEach(a => {
      const g = grupos.get(a.ubicacion) ?? { cantidad: 0, lat: 0, lng: 0 };
      g.cantidad++;
      g.lat += Number(a.lat) || 0;
      g.lng += Number(a.lng) || 0;
      grupos.set(a.ubicacion, g);
    });

    const top = [...grupos.entries()]
      .map(([nombre, g]) => ({
        nombre,
        cantidad: g.cantidad,
        lat: g.lat / g.cantidad,
        lng: g.lng / g.cantidad,
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    this.rankingZonas = top.map(z => ({ nombre: z.nombre, cantidad: z.cantidad }));

    const W = 300, H = 190, padX = 55, padY = 42;
    const lats = top.map(z => z.lat);
    const lngs = top.map(z => z.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const rangoLat = maxLat - minLat || 1;
    const rangoLng = maxLng - minLng || 1;
    const maxCant = top.length ? top[0].cantidad : 1;

    this.burbujasZona = top.map(z => ({
      nombre: z.nombre,
      cantidad: z.cantidad,
      x: top.length === 1 ? W / 2 : padX + ((z.lng - minLng) / rangoLng) * (W - 2 * padX),
      y: top.length === 1 ? H / 2 - 10 : padY + (1 - (z.lat - minLat) / rangoLat) * (H - 2 * padY),
      r: 10 + (z.cantidad / maxCant) * 14,
    }));
  }

  // ── Tendencia: alertas por día de la semana ────────────────────
  private calcularTendencia(lista: AlertaVM[]): void {
    const conteo: number[] = new Array(7).fill(0);

    lista.forEach(a => {
      const fecha = a.created_at ?? a.started_at;
      if (!fecha) return;
      const d = new Date(fecha);
      if (isNaN(d.getTime())) return;
      conteo[(d.getDay() + 6) % 7]++; // lunes = 0
    });

    this.tendenciaTotal = conteo.reduce((s, v) => s + v, 0);

    const { izq, der, arriba, abajo } = this.graf;
    const maximo = Math.max(...conteo, 1);
    const escala = Math.max(4, Math.ceil(maximo / 4) * 4);
    const altoUtil = abajo - arriba;

    this.tendenciaTicks = [0, 1, 2, 3, 4].map(i => {
      const valor = (escala / 4) * i;
      return { y: abajo - (valor / escala) * altoUtil, label: valor };
    });

    this.tendenciaDots = conteo.map((valor, i) => ({
      x: izq + (i * (der - izq)) / 6,
      y: abajo - (valor / escala) * altoUtil,
      valor,
    }));

    this.tendenciaLabels = DIAS_SEMANA.map((texto, i) => ({
      x: izq + (i * (der - izq)) / 6,
      texto,
    }));

    this.tendenciaLinea = this.tendenciaDots
      .map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
    this.tendenciaArea = `${izq},${abajo} ${this.tendenciaLinea} ${der},${abajo}`;
  }
}