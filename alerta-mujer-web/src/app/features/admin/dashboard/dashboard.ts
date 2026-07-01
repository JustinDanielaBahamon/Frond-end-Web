import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';

import { AlertsService } from '../../../core/services/alerts.services';
import { RiskZonesService } from '../../../core/services/risk-zones.services';
import { UsersService } from '../../../core/services/users.services';
import { Alerta } from '../../../core/models/alert.model';
import { ZonaManual } from '../../../core/models/zona.model';

export interface AlertaPorTipo {
  tipo: string;
  cantidad: number;
  porcentaje: number;
  color: string;
}

export interface ZonaCriticaVM {
  nombre: string;
  alertas: number;
}

const COLOR_POR_TIPO: Record<string, string> = {
  SOS: '#ef4444',
  Medical: '#7c3aed',
  Robo: '#a78bfa',
  Acoso: '#c4b5fd',
};

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

  // --- Período ---
  periodoGlobal = 'Todos los datos';
  periodos = ['Todos los datos'];
  showPeriodoMenu = false;

  // --- Datos base ---
  private alertas: Alerta[] = [];
  private zonas: ZonaManual[] = [];

  // --- Stat Cards (reales) ---
  totalUsuarias = 0;
  alertasActivas = 0;
  zonasCriticas = 0;
  alertasAltas = 0;
  alertasMedias = 0;
  alertasEmergencia = 0;
  alertasOtras = 0;
  alertasAtivas = 0;

  // --- Zonas Críticas: top 3 reales ---
  topZonas: ZonaCriticaVM[] = [];

  // --- Comportamiento: ahora agrupado por ZONA en vez de por día
  // (no tenemos fecha real por alerta, así que usamos algo que SÍ es real: alertas por zona)
  zonasLabels: string[] = [];
  alertasPorZonaSerie: number[] = [];

  // --- Donut: alertas por tipo (real) ---
  alertasPorTipo: AlertaPorTipo[] = [];

  // --- Barras: ahora "alertas por tipo" en vez de "por horario" (dato real que sí tenemos) ---
  horariosLabels: string[] = [];
  horariosData: number[] = [];

  // --- Mini chart usuarias: usamos el total real como único valor visible ---
  miniUsuariasData: number[] = [];

  // --- Tabla: últimas 5 alertas reales ---
  alertasRecientes: Alerta[] = [];

  ngOnInit(): void {
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.cargando = true;
    forkJoin({
      alertas: this.alertsService.getAll(),
      zonas: this.riskZonesService.getZonas(),
      usuarios: this.usersService.getAll(),
    }).subscribe({
      next: ({ alertas, zonas, usuarios }) => {
        this.alertas = alertas;
        this.zonas = zonas;

        // Mismos números que en alert-admin
        this.alertasActivas = alertas.filter(a => a.estado === 'Pendiente').length;
        this.zonasCriticas = zonas.length;
        this.totalUsuarias = usuarios.length;

        // Desglose real por tipo
        this.alertasPorTipo = this.calcularAlertasPorTipo(alertas);
        this.alertasAltas = alertas.filter(a => a.tipo === 'SOS').length;
        this.alertasMedias = alertas.filter(a => a.tipo === 'Robo' || a.tipo === 'Acoso').length;
        this.alertasEmergencia = alertas.filter(a => a.tipo === 'Medical').length;
        this.alertasOtras = alertas.length - this.alertasAltas - this.alertasMedias - this.alertasEmergencia;
        this.alertasAtivas = this.alertasActivas;

        // Top 3 zonas reales
        this.topZonas = [...zonas]
          .sort((a, b) => b.alertasEnZona - a.alertasEnZona)
          .slice(0, 3)
          .map(z => ({ nombre: z.nombre, alertas: z.alertasEnZona }));

        // Barras: reutilizamos el gráfico de barras para mostrar alertas por tipo (dato real)
        this.horariosLabels = this.alertasPorTipo.map(t => t.tipo);
        this.horariosData = this.alertasPorTipo.map(t => t.cantidad);

        // Línea de "comportamiento": alertas agrupadas por ubicación (dato real)
        const porUbicacion = this.calcularAlertasPorUbicacion(alertas);
        this.zonasLabels = porUbicacion.map(u => u.ubicacion);
        this.alertasPorZonaSerie = porUbicacion.map(u => u.cantidad);

        // Mini gráfico usuarias: repetimos el total para dar forma de línea plana real
        this.miniUsuariasData = new Array(6).fill(this.totalUsuarias);

        // Tabla: últimas 5 alertas reales
        this.alertasRecientes = alertas.slice(-5).reverse();

        this.cargando = false;
      },
      error: (err) => {
        console.error('Error cargando dashboard:', err);
        this.cargando = false;
      }
    });
  }

  private calcularAlertasPorTipo(alertas: Alerta[]): AlertaPorTipo[] {
    const total = alertas.length || 1;
    const conteo: Record<string, number> = {};
    alertas.forEach(a => { conteo[a.tipo] = (conteo[a.tipo] ?? 0) + 1; });

    return Object.entries(conteo).map(([tipo, cantidad]) => ({
      tipo,
      cantidad,
      porcentaje: Math.round((cantidad / total) * 100),
      color: COLOR_POR_TIPO[tipo] ?? '#c4b5fd',
    }));
  }

  private calcularAlertasPorUbicacion(alertas: Alerta[]): { ubicacion: string; cantidad: number }[] {
    const conteo: Record<string, number> = {};
    alertas.forEach(a => { conteo[a.ubicacion] = (conteo[a.ubicacion] ?? 0) + 1; });
    return Object.entries(conteo).map(([ubicacion, cantidad]) => ({ ubicacion, cantidad }));
  }

  // ===================== MÉTODOS SVG (se mantienen, ahora alimentados con datos reales) =====================

  miniLinePoints(data: number[], w = 180, h = 55): string {
    if (data.length === 0) return '';
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    return data.map((v, i) => {
      const x = (i / (data.length - 1 || 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    }).join(' ');
  }

  polylinePoints(data: number[], w = 475, h = 170): string {
    if (data.length === 0) return '';
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    return data.map((v, i) => {
      const x = (i / (data.length - 1 || 1)) * w;
      const y = h - ((v - min) / range) * (h - 10);
      return `${x},${y}`;
    }).join(' ');
  }

  get registroPolygonPoints(): string {
    const pts = this.polylinePoints(this.alertasPorZonaSerie, 475, 180);
    if (!pts) return '25,185 500,185';
    const shifted = pts.split(' ').map(p => {
      const [x, y] = p.split(',');
      return `${parseFloat(x) + 25},${y}`;
    }).join(' ');
    return `25,185 ${shifted} 500,185`;
  }

  donutSegments(): { d: string; color: string; tipo: string; porcentaje: number }[] {
    const r = 60; const cx = 80; const cy = 80;
    let startAngle = -90;
    return this.alertasPorTipo.map(item => {
      const angle = (item.porcentaje / 100) * 360;
      const endAngle = startAngle + angle;
      const largeArc = angle > 180 ? 1 : 0;
      const x1 = cx + r * Math.cos((startAngle * Math.PI) / 180);
      const y1 = cy + r * Math.sin((startAngle * Math.PI) / 180);
      const x2 = cx + r * Math.cos((endAngle * Math.PI) / 180);
      const y2 = cy + r * Math.sin((endAngle * Math.PI) / 180);
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      startAngle = endAngle;
      return { d, color: item.color, tipo: item.tipo, porcentaje: item.porcentaje };
    });
  }

  barMaxValue(): number {
    return this.horariosData.length ? Math.max(...this.horariosData) : 1;
  }

  barMaxValueZonas(): number {
    return this.alertasPorZonaSerie.length ? Math.max(...this.alertasPorZonaSerie) : 1;
  }

  barHeight(val: number, maxH = 120): number {
    return (val / this.barMaxValue()) * maxH;
  }

  getTipoBadgeClass(tipo: string): string {
    const map: Record<string, string> = {
      SOS: 'badge-robo',
      Medical: 'badge-emergencia-medica',
      Robo: 'badge-robo',
      Acoso: 'badge-acoso',
    };
    return map[tipo] ?? 'badge-otros';
  }

  togglePeriodo(): void { this.showPeriodoMenu = !this.showPeriodoMenu; }

  selectPeriodo(p: string): void {
    this.periodoGlobal = p;
    this.showPeriodoMenu = false;
  }
}