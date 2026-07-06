import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';

import { AlertsService } from '../../../core/services/alerts.services';
import { RiskZonesService } from '../../../core/services/risk-zones.services';
import { UsersService } from '../../../core/services/users.services';
import { Alerta } from '../../../core/models/alert.model';
import { ZonaManual } from '../../../core/models/zona.model';
import { PeriodBadge } from '../../../shared/components/period-badge/period-badge';

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
  imports: [CommonModule, PeriodBadge],
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

  topZonas: ZonaCriticaVM[] = [];

  zonasLabels: string[] = [];
  alertasPorZonaSerie: number[] = [];

  alertasPorTipo: AlertaPorTipo[] = [];

  horariosLabels: string[] = [];
  horariosData: number[] = [];

  miniUsuariasData: number[] = [];

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

        this.alertasActivas = alertas.filter(a => a.estado === 'Pendiente').length;
        this.zonasCriticas = zonas.length;
        this.totalUsuarias = usuarios.length;

        this.alertasPorTipo = this.calcularAlertasPorTipo(alertas);
        this.alertasAltas = alertas.filter(a => a.tipo === 'SOS').length;
        this.alertasMedias = alertas.filter(a => a.tipo === 'Robo' || a.tipo === 'Acoso').length;
        this.alertasEmergencia = alertas.filter(a => a.tipo === 'Medical').length;

        this.topZonas = [...zonas]
          .sort((a, b) => b.alertasEnZona - a.alertasEnZona)
          .slice(0, 3)
          .map(z => ({ nombre: z.nombre, alertas: z.alertasEnZona }));

        this.horariosLabels = this.alertasPorTipo.map(t => t.tipo);
        this.horariosData = this.alertasPorTipo.map(t => t.cantidad);

        const porUbicacion = this.contarPor(alertas, a => a.ubicacion);
        this.zonasLabels = porUbicacion.map(u => u.clave);
        this.alertasPorZonaSerie = porUbicacion.map(u => u.cantidad);

        this.miniUsuariasData = new Array(6).fill(this.totalUsuarias);

        this.alertasRecientes = alertas.slice(-5).reverse();

        this.cargando = false;
      },
      error: (err) => {
        console.error('Error cargando dashboard:', err);
        this.cargando = false;
      }
    });
  }

  // ── Helpers de agregación ──────────────────────────────────────
  // Único punto de verdad para "contar ocurrencias agrupadas por una clave"
  // (antes duplicado en calcularAlertasPorTipo y calcularAlertasPorUbicacion)
  private contarPor<T>(items: T[], obtenerClave: (item: T) => string): { clave: string; cantidad: number }[] {
    const conteo: Record<string, number> = {};
    items.forEach(item => {
      const clave = obtenerClave(item);
      conteo[clave] = (conteo[clave] ?? 0) + 1;
    });
    return Object.entries(conteo).map(([clave, cantidad]) => ({ clave, cantidad }));
  }

  private calcularAlertasPorTipo(alertas: Alerta[]): AlertaPorTipo[] {
    const total = alertas.length || 1;
    return this.contarPor(alertas, a => a.tipo).map(({ clave, cantidad }) => ({
      tipo: clave,
      cantidad,
      porcentaje: Math.round((cantidad / total) * 100),
      color: COLOR_POR_TIPO[clave] ?? '#c4b5fd',
    }));
  }

  // ── Helpers de gráficos ──────────────────────────────────────
  // Único punto de verdad para normalizar un array de valores en puntos
  // de un polyline SVG (antes duplicado en miniLinePoints y polylinePoints)
  private normalizarPuntos(data: number[], w: number, h: number, margenSuperior = 0): string {
    if (data.length === 0) return '';
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    return data.map((v, i) => {
      const x = (i / (data.length - 1 || 1)) * w;
      const y = h - ((v - min) / range) * (h - margenSuperior);
      return `${x},${y}`;
    }).join(' ');
  }

  miniLinePoints(data: number[], w = 180, h = 55): string {
    return this.normalizarPuntos(data, w, h);
  }

  polylinePoints(data: number[], w = 475, h = 170): string {
    return this.normalizarPuntos(data, w, h, 10);
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

  // Único punto de verdad para "altura máxima de un set de barras"
  // (antes duplicado en barMaxValue y barMaxValueZonas)
  private maxDe(data: number[]): number {
    return data.length ? Math.max(...data) : 1;
  }

  barMaxValue(): number {
    return this.maxDe(this.horariosData);
  }

  barMaxValueZonas(): number {
    return this.maxDe(this.alertasPorZonaSerie);
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
}