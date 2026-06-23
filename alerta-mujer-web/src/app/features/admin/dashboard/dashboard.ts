import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Alert {
  hora: string;
  ubicacion: string;
  coordenadas: string;
  tipo: string;
  estado: 'Active' | 'Inactive';
}

export interface ZonaCritica {
  nombre: string;
  alertas: number;
}

export interface AlertaPorTipo {
  tipo: string;
  porcentaje: number;
  color: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class AdminDashboardComponent {

  // --- Período ---
  periodoGlobal = 'Últimos 7 días';
  periodos = ['Últimos 7 días', 'Últimos 30 días', 'Este mes', 'Este año'];
  showPeriodoMenu = false;

  // --- Stat Cards ---
  totalUsuarias = 15230;
  alertasActivas = 152;
  zonasCriticas = 34;
  alertasAltas = 25;
  alertasMedias = 127;
  alertasEmergencia = 15;
  alertasOtras = 127;
  alertasAtivas = 72;

  // --- Zonas Críticas ---
  topZonas: ZonaCritica[] = [
    { nombre: 'Centro', alertas: 12 },
    { nombre: 'Centro', alertas: 8 },
    { nombre: 'Colmgro', alertas: 3 },
  ];

  // --- Comportamiento ---
  diasLabels = ['1d','1d','1d','1d','2d','7d','2d','7d','2d','3d','3d','3d','3d'];

  tendenciaData = {
    robo:  [80, 95, 60, 110, 130, 100, 150, 90,  70, 120, 140, 100, 80],
    acoso: [50, 70, 80,  60,  90, 110,  80, 130, 100,  70,  60,  90, 110],
    roero: [30, 45, 55,  40,  60,  75,  55,  80,  65,  50,  45,  60,  70],
    otros: [20, 30, 25,  35,  45,  30,  50,  40,  30,  45,  35,  25,  30],
  };

  registroData = [2000, 4000, 5000, 3000, 6000, 8000, 5000, 9000, 7000, 4000, 3000, 5000, 6000];

  // --- Donut ---
  alertasPorTipo: AlertaPorTipo[] = [
    { tipo: 'Acoso',            porcentaje: 40, color: '#7c3aed' },
    { tipo: 'Robo',             porcentaje: 20, color: '#a78bfa' },
    { tipo: 'Emergencia Médica',porcentaje: 15, color: '#c4b5fd' },
    { tipo: 'Otros',            porcentaje: 25, color: '#ddd6fe' },
  ];

  // --- Barras ---
  horariosLabels = ['00:00','03:00','06:00','09:00','12:00','15:00','18:00'];
  horariosData   = [120, 80, 60, 180, 250, 200, 300];

  // --- Mini charts data ---
  miniUsuariasData = [60, 80, 55, 90, 70, 100, 85, 110, 95, 120];

  // --- Tabla ---
  alertasRecientes: Alert[] = [
    { hora: '07:29:09 AM', ubicacion: 'Centro', coordenadas: '-0.715425, -0.095805', tipo: 'Robo',              estado: 'Active' },
    { hora: '07:38:36 AM', ubicacion: 'Centro', coordenadas: '-0.715538, -0.096875', tipo: 'Acoso',             estado: 'Active' },
    { hora: '07:08:59 AM', ubicacion: 'Centro', coordenadas: '-0.715333, -0.099875', tipo: 'Emergencia Médica', estado: 'Active' },
    { hora: '07:08:45 AM', ubicacion: 'Centro', coordenadas: '-0.715528, -0.098875', tipo: 'Emergencia',        estado: 'Active' },
    { hora: '07:08:49 PM', ubicacion: 'Centro', coordenadas: '-0.715523, -0.095875', tipo: 'Otros',             estado: 'Active' },
  ];

  // ===================== MÉTODOS SVG =====================

  miniLinePoints(data: number[], w = 180, h = 55): string {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    return data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    }).join(' ');
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

  barMaxValue(): number { return Math.max(...this.horariosData); }

  barHeight(val: number, maxH = 120): number {
    return (val / this.barMaxValue()) * maxH;
  }

  // Getter para el área rellena del registro de usuarias (usado en [attr.points] del polygon)
  get registroPolygonPoints(): string {
    const pts = this.polylinePoints(this.registroData, 475, 180);
    const shifted = pts.split(' ').map(p => {
      const [x, y] = p.split(',');
      return `${parseFloat(x) + 25},${y}`;
    }).join(' ');
    return `25,185 ${shifted} 500,185`;
  }

  polylinePoints(data: number[], w = 475, h = 170): string {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    return data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 10);
      return `${x},${y}`;
    }).join(' ');
  }

  getTipoBadgeClass(tipo: string): string {
    const map: Record<string, string> = {
      'Robo':             'badge-robo',
      'Acoso':            'badge-acoso',
      'Emergencia Médica':'badge-emergencia-medica',
      'Emergencia':       'badge-emergencia',
      'Otros':            'badge-otros',
    };
    return map[tipo] ?? 'badge-otros';
  }

  togglePeriodo(): void { this.showPeriodoMenu = !this.showPeriodoMenu; }

  selectPeriodo(p: string): void {
    this.periodoGlobal = p;
    this.showPeriodoMenu = false;
  }
}