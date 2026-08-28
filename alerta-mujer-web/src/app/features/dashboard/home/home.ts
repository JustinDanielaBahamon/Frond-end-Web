import { Component, OnDestroy, AfterViewInit, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { AuthService } from '../../../core/auth/auth.service';

interface StatCard {
  label: string;
  value: string;
  sub: string;
  icon: string;
  color: 'purple' | 'red' | 'teal' | 'amber';
  trend?: { dir: 'up' | 'down'; percent: number };
  statusDot?: boolean;
}

interface ActividadItem {
  icon: string;
  color: 'purple' | 'red' | 'green';
  titulo: string;
  fecha: string;
  estado?: string;
}

interface DistribucionItem {
  tipo: string;
  count: number;
  color: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, NgClass, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements AfterViewInit, OnDestroy {

  @ViewChild('mapWrapper') mapWrapper!: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private authService = inject(AuthService);

  panelAbierto = false;

  // ── TARJETAS DE ESTADÍSTICAS ─────────────────────
  statCards: StatCard[] = [
    { label: 'Total Alertas', value: '24', sub: 'Este mes', icon: 'ti-users', color: 'purple', trend: { dir: 'up', percent: 12 } },
    { label: 'SOS Enviados', value: '12', sub: 'Este mes', icon: 'ti-alert-octagon', color: 'red', trend: { dir: 'down', percent: 8 } },
    { label: 'Evidencias Guardadas', value: '37', sub: 'Este mes', icon: 'ti-shield-check', color: 'teal', trend: { dir: 'up', percent: 18 } },
    { label: 'Tiempo Protegido', value: '86h 24m', sub: 'Este mes', icon: 'ti-clock', color: 'amber' },
    { label: 'Sincronización', value: 'En línea', sub: 'Última: Hace 1 min', icon: 'ti-wifi', color: 'purple', statusDot: true },
  ];

  // ── ZONAS DE RIESGO (mapa) ───────────────────────
  zonas = [
    { lat: 2.2964, lng: -75.0199, nombre: 'Campoalegre Centro',     alertas: 24, porcentaje: 42, nivel: 'alto',  color: '#ef4444' },
    { lat: 2.9273, lng: -75.2819, nombre: 'Av. Santander, Neiva',   alertas: 15, porcentaje: 26, nivel: 'medio', color: '#f59e0b' },
    { lat: 2.9356, lng: -75.2945, nombre: 'Terminal Neiva',          alertas: 10, porcentaje: 17, nivel: 'medio', color: '#f59e0b' },
    { lat: 2.1978, lng: -75.6273, nombre: 'Parque Central, Garzón', alertas: 6,  porcentaje: 10, nivel: 'bajo',  color: '#10b981' },
    { lat: 2.2971, lng: -75.0210, nombre: 'Calle 15, Campoalegre',  alertas: 3,  porcentaje: 5,  nivel: 'bajo',  color: '#10b981' },
  ];

  // ── GRÁFICA DE TENDENCIA (línea) ─────────────────
  chartData = [
    { mes: 'J', valor: 15 }, { mes: 'F', valor: 18 }, { mes: 'M', valor: 22 },
    { mes: 'A', valor: 25 }, { mes: 'M', valor: 20 }, { mes: 'J', valor: 10 },
    { mes: 'J', valor: 12 }, { mes: 'A', valor: 20 }, { mes: 'S', valor: 18 },
    { mes: 'O', valor: 22 }, { mes: 'N', valor: 14 }, { mes: 'D', valor: 9  },
  ];
  private readonly chartMax = 30;
  private readonly chartW = 300;
  private readonly chartH = 120;

  get lineChartPoints(): string {
    const stepX = this.chartW / (this.chartData.length - 1);
    return this.chartData
      .map((d, i) => `${i * stepX},${this.chartH - (d.valor / this.chartMax) * this.chartH}`)
      .join(' ');
  }

  get lineChartAreaPath(): string {
    const stepX = this.chartW / (this.chartData.length - 1);
    const pts = this.chartData.map(
      (d, i) => `${i * stepX},${this.chartH - (d.valor / this.chartMax) * this.chartH}`
    );
    return `M0,${this.chartH} L${pts.join(' L')} L${this.chartW},${this.chartH} Z`;
  }

  dotX(i: number): number {
    return i * (this.chartW / (this.chartData.length - 1));
  }

  dotY(valor: number): number {
    return this.chartH - (valor / this.chartMax) * this.chartH;
  }

  // ── ACTIVIDAD RECIENTE (lista compacta) ──────────
  actividadReciente: ActividadItem[] = [
    { icon: 'ti-alert-octagon', color: 'red',    titulo: 'Alerta SOS enviada',    fecha: 'Hoy, 12:30 PM',   estado: 'Atendida' },
    { icon: 'ti-map-pin',       color: 'purple', titulo: 'Ubicación registrada',  fecha: 'Hoy, 11:45 AM' },
    { icon: 'ti-camera',        color: 'green',  titulo: 'Evidencia guardada',    fecha: 'Hoy, 10:20 AM' },
    { icon: 'ti-shield',        color: 'purple', titulo: 'Alerta de seguimiento', fecha: 'Ayer, 07:40 PM',  estado: 'En curso' },
  ];

  // ── RESUMEN DE SEGURIDAD (medidor) ───────────────
  resumenSeguridad = {
    percent: 80,
    calificacion: 'Muy bueno',
    mensaje: '¡Sigue así! Tu nivel de protección ha mejorado un 15% este mes.',
  };

  get resumenGradient(): string {
    const p = this.resumenSeguridad.percent;
    return `conic-gradient(#7c3aed 0%, #10b981 ${p}%, rgba(255,255,255,0.08) ${p}% 100%)`;
  }

  // ── DISTRIBUCIÓN DE ALERTAS POR TIPO (dona) ──────
  distribucionAlertas: DistribucionItem[] = [
    { tipo: 'SOS',         count: 12, color: '#ef4444' },
    { tipo: 'Seguimiento', count: 6,  color: '#7c3aed' },
    { tipo: 'Evidencia',   count: 6,  color: '#f59e0b' },
    { tipo: 'Otro',        count: 2,  color: '#06b6d4' },
  ];

  get distribucionTotal(): number {
    return this.distribucionAlertas.reduce((sum, d) => sum + d.count, 0);
  }

  distribucionPercent(count: number): number {
    return Math.round((count / this.distribucionTotal) * 100);
  }

  get distribucionGradient(): string {
    let acc = 0;
    const stops = this.distribucionAlertas.map(d => {
      const start = acc;
      acc += (d.count / this.distribucionTotal) * 100;
      return `${d.color} ${start}% ${acc}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }

  // ── CONSEJO DE SEGURIDAD ──────────────────────────
  consejo = {
    icono: 'ti-shield-lock',
    texto: 'Activa el acceso rápido a SOS desde tu pantalla de bloqueo',
  };

  togglePanel(): void {
    this.panelAbierto = !this.panelAbierto;
    setTimeout(() => this.map?.invalidateSize(), 300);
  }

  /** Botón "Ampliar" del mapa compacto: entra a pantalla completa y abre
   * de una vez el panel con la lista de zonas, ya que ahí sí hay espacio. */
  verZonasDetalle(): void {
    if (!document.fullscreenElement) {
      this.toggleFullscreen();
    }
    setTimeout(() => {
      this.panelAbierto = true;
      this.map?.invalidateSize();
    }, 250);
  }

  toggleFullscreen(): void {
    const el = this.mapWrapper.nativeElement;

    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => {
        setTimeout(() => this.map?.invalidateSize(), 200);
      }).catch(err => {
        console.error('Error al entrar en fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setTimeout(() => this.map?.invalidateSize(), 200);
      }).catch(err => {
        console.error('Error al salir de fullscreen:', err);
      });
    }
  }

  irAZona(zona: any): void {
    if (this.map) {
      this.map.flyTo([zona.lat, zona.lng], 13, { duration: 1 });
      this.map.eachLayer((layer: any) => {
        if (layer instanceof L.Circle) {
          const latlng = layer.getLatLng();
          if (
            Math.abs(latlng.lat - zona.lat) < 0.001 &&
            Math.abs(latlng.lng - zona.lng) < 0.001
          ) {
            layer.openPopup();
          }
        }
      });
    }
  }

  ngAfterViewInit(): void {
    const iconDefault = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });
    L.Marker.prototype.options.icon = iconDefault;
    setTimeout(() => this.inicializarMapa(), 100);
  }

  private inicializarMapa(): void {
    this.map = L.map('dashboard-map', {
      center: [2.6, -75.15],
      zoom: 8,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(this.map);

    this.zonas.forEach(zona => {
      L.circle([zona.lat, zona.lng], {
        color: zona.color,
        fillColor: zona.color,
        fillOpacity: 0.25,
        weight: 2,
        radius: zona.alertas * 300,
      })
      .addTo(this.map!)
      .bindPopup(`
        <div style="font-family:sans-serif; min-width:170px; padding:4px">
          <strong style="color:#2d1457; font-size:13px">${zona.nombre}</strong><br/>
          <hr style="border:none; border-top:1px solid #ede9fe; margin:6px 0"/>
          <span style="color:#7c3aed">🔔 ${zona.alertas} alertas</span><br/>
          <span style="color:#be185d">📊 ${zona.porcentaje}% del total</span><br/>
          <span style="
            display:inline-block;
            margin-top:6px;
            padding:2px 10px;
            border-radius:50px;
            font-size:11px;
            font-weight:700;
            background:${zona.color}22;
            color:${zona.color};
            text-transform:uppercase;
          ">● Riesgo ${zona.nivel}</span>
        </div>
      `);

      const nivelIcon = L.divIcon({
        className: '',
        html: `
          <div style="
            background:${zona.color};
            border:2px solid #fff;
            border-radius:50%;
            width:14px;
            height:14px;
            box-shadow:0 1px 4px rgba(0,0,0,0.35);
          "></div>
        `,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      L.marker([zona.lat, zona.lng], { icon: nivelIcon })
        .addTo(this.map!)
        .bindTooltip(`<b>${zona.nombre}</b><br/>Riesgo ${zona.nivel}`, {
          direction: 'top',
          offset: [0, -10],
        });
    });
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}