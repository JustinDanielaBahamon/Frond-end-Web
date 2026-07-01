import { Component, OnDestroy, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { AlertsService } from '../../../core/services/alerts.services';
import { RiskZonesService } from '../../../core/services/risk-zones.services';
import { Alerta } from '../../../core/models/alert.model';
import { ZonaManual, ZonaCaliente, PuntoMapa } from '../../../core/models/zona.model';

declare const L: any;

@Component({
  selector: 'app-alert-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alert-admin.html',
  styleUrl: './alert-admin.scss',
})
export class AlertAdminComponent implements AfterViewInit, OnDestroy {

  private alertsService = inject(AlertsService);
  private riskZonesService = inject(RiskZonesService);

  // ── Mapa ─────────────────────────────────────────────────────
  private mapa: any;
  private marcadoresAlertas: Map<number, any> = new Map();
  private marcadoresPuntos: { marker: any; tipo: string }[] = [];
  private capasZonas: Map<number, any> = new Map();
  private circulosCalor: any[] = [];

  private circuloPreview: any = null;
  private marcadorCentro: any = null;

  // ── UI state ─────────────────────────────────────────────────
  tabActivo: 'alertas' | 'zonas' = 'alertas';
  fabOpen = false;
  filtrosOpen = true;
  modalZona = false;
  modalPunto = false;
  cargando = true;

  alertaActiva: Alerta | null = null;
  filtroTipo   = 'Todos';
  filtroEstado = 'Todos';
  filtroNivel  = 'Todos';
  alertasFiltradas: Alerta[] = [];

  capas = { alertas: true, zonas: true, cais: true, hospitales: true, calor: true };

  // ── Modal zona ───────────────────────────────────────────────
  modoZona: 'pin' | 'area' = 'area';
  esperandoClickZona = false;

  nuevaZona = {
    nombre: '',
    nivel: 'Alto' as 'Alto' | 'Medio' | 'Bajo',
    lat: 0,
    lng: 0,
    radio: 300,
  };

  nivelesRiesgo: { value: 'Alto' | 'Medio' | 'Bajo'; label: string }[] = [
    { value: 'Alto',  label: '🔴 Alto'  },
    { value: 'Medio', label: '🟠 Medio' },
    { value: 'Bajo',  label: '🟡 Bajo'  },
  ];

  filtrosNivel = [
    { value: 'Todos', label: 'Todas'    },
    { value: 'Alto',  label: '🔴 Alto'  },
    { value: 'Medio', label: '🟠 Medio' },
    { value: 'Bajo',  label: '🟡 Bajo'  },
  ];

  // ── Modal punto CAI/Hospital ──────────────────────────────────
  nuevoPunto = { tipo: 'CAI', nombre: '', lat: 0, lng: 0 };
  esperandoClickPunto = false;

  // ── Datos — ahora vacíos, se llenan vía API ─────────────────────
  alertas: Alerta[] = [];
  zonasManuales: ZonaManual[] = [];
  puntosMapa: PuntoMapa[] = [];

  // ── Getters ──────────────────────────────────────────────────
  get alertasPendientes(): number {
    return this.alertas.filter(a => a.estado === 'Pendiente').length;
  }

  get zonasCalientes(): ZonaCaliente[] {
    const grupos: ZonaCaliente[] = [];
    const procesadas = new Set<number>();

    this.alertas.forEach(a => {
      if (procesadas.has(a.id)) return;
      const cercanas = this.alertas.filter(b =>
        !procesadas.has(b.id) &&
        Math.abs(b.lat - a.lat) < 0.004 &&
        Math.abs(b.lng - a.lng) < 0.004
      );
      if (cercanas.length >= 2) {
        cercanas.forEach(b => procesadas.add(b.id));
        const lat = cercanas.reduce((s, b) => s + b.lat, 0) / cercanas.length;
        const lng = cercanas.reduce((s, b) => s + b.lng, 0) / cercanas.length;
        const nivel: 'Alto' | 'Medio' | 'Bajo' =
          cercanas.length >= 5 ? 'Alto' : cercanas.length >= 3 ? 'Medio' : 'Bajo';
        grupos.push({ nombre: `Zona ${a.ubicacion}`, lat, lng, alertas: cercanas.length, nivel });
      }
    });

    return grupos.sort((a, b) => b.alertas - a.alertas);
  }

  get zonasManualesFiltradas(): ZonaManual[] {
    if (this.filtroNivel === 'Todos') return this.zonasManuales;
    return this.zonasManuales.filter(z => z.nivel === this.filtroNivel);
  }

  // ── Lifecycle ────────────────────────────────────────────────
  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initMapaYData();
    }, 150);
  }

  ngOnDestroy(): void { if (this.mapa) this.mapa.remove(); }

  // ── Init mapa + carga de datos reales ──────────────────────────
  private initMapaYData(): void {
    if (typeof L === 'undefined') {
      console.warn('Leaflet no cargado — agrega el CDN en index.html');
      return;
    }

    this.mapa = L.map('mapa-leaflet', { center: [4.7110, -74.0721], zoom: 14 });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(this.mapa);

    this.mapa.on('click', (e: any) => this.onMapaClick(e));

    this.cargando = true;
    forkJoin({
      alertas: this.alertsService.getAll(),
      zonas: this.riskZonesService.getZonas(),
      puntos: this.riskZonesService.getPuntos(),
    }).subscribe({
      next: ({ alertas, zonas, puntos }) => {
        this.alertas = alertas;
        this.zonasManuales = zonas;
        this.puntosMapa = puntos;
        this.alertasFiltradas = [...this.alertas];

        this.pintarAlertas();
        this.pintarPuntos();
        this.pintarCalor();
        this.repintarZonasGuardadas();

        this.cargando = false;
        setTimeout(() => this.mapa?.invalidateSize(), 200);
      },
      error: (err) => {
        console.error('Error cargando datos del mapa:', err);
        this.cargando = false;
      }
    });
  }

  private repintarZonasGuardadas(): void {
    this.zonasManuales.forEach(z => {
      const color = this.colorPorNivel(z.nivel);
      let capa: any;

      if (z.metodo === 'area') {
        capa = L.circle(
          [z.centroLat, z.centroLng],
          { radius: z.radio ?? 300, color, fillColor: color, fillOpacity: 0.2, weight: 2 }
        ).bindTooltip(`${z.nombre} (${z.nivel})`).addTo(this.mapa);
      } else {
        const svg = this.crearSvgPin(color);
        const icon = L.divIcon({ html: svg, className: '', iconSize: [32, 42], iconAnchor: [16, 42] });
        capa = L.marker([z.centroLat, z.centroLng], { icon })
          .bindTooltip(`⚠️ ${z.nombre} (${z.nivel})`).addTo(this.mapa);
      }

      this.capasZonas.set(z.id, capa);
    });
  }

  // ── Click en mapa ────────────────────────────────────────────
  private onMapaClick(e: any): void {
    const { lat, lng } = e.latlng;

    if (this.modalZona && this.esperandoClickZona) {
      this.nuevaZona.lat = parseFloat(lat.toFixed(6));
      this.nuevaZona.lng = parseFloat(lng.toFixed(6));
      this.esperandoClickZona = false;
      this.actualizarPreviewZona();
      return;
    }

    if (this.modalPunto && this.esperandoClickPunto) {
      this.nuevoPunto.lat = parseFloat(lat.toFixed(6));
      this.nuevoPunto.lng = parseFloat(lng.toFixed(6));
    }
  }

  // ── Preview círculo en mapa al elegir área ────────────────────
  actualizarPreviewZona(): void {
    if (!this.mapa || this.nuevaZona.lat === 0) return;

    this.limpiarPreview();

    if (this.modoZona === 'area') {
      const color = this.colorPorNivel(this.nuevaZona.nivel);
      this.circuloPreview = L.circle(
        [this.nuevaZona.lat, this.nuevaZona.lng],
        { radius: this.nuevaZona.radio, color, fillColor: color, fillOpacity: 0.2, weight: 2, dashArray: '6,4' }
      ).addTo(this.mapa);
    }

    this.marcadorCentro = L.circleMarker(
      [this.nuevaZona.lat, this.nuevaZona.lng],
      { radius: 6, fillColor: this.colorPorNivel(this.nuevaZona.nivel), color: '#fff', weight: 2, fillOpacity: 1 }
    ).addTo(this.mapa);

    this.mapa.flyTo([this.nuevaZona.lat, this.nuevaZona.lng], 15, { duration: 0.5 });
  }

  private limpiarPreview(): void {
    if (this.circuloPreview)  { this.mapa?.removeLayer(this.circuloPreview);  this.circuloPreview  = null; }
    if (this.marcadorCentro)  { this.mapa?.removeLayer(this.marcadorCentro);  this.marcadorCentro  = null; }
  }

  // ── Abrir modal zona nueva ────────────────────────────────────
  abrirModalZona(modo: 'pin' | 'area' = 'area'): void {
    this.fabOpen = false;
    this.modoZona = modo;
    this.nuevaZona = { nombre: '', nivel: 'Alto', lat: 0, lng: 0, radio: 300 };
    this.esperandoClickZona = false;
    this.limpiarPreview();
    this.modalZona = true;
    this.tabActivo = 'zonas';
  }

  activarClickEnMapa(): void {
    this.esperandoClickZona = true;
  }

  setNivel(value: 'Alto' | 'Medio' | 'Bajo'): void {
    this.nuevaZona.nivel = value;
    if (this.nuevaZona.lat !== 0) this.actualizarPreviewZona();
  }

  onRadioChange(): void {
    if (this.nuevaZona.lat !== 0) this.actualizarPreviewZona();
  }

  cancelarModalZona(): void {
    this.modalZona = false;
    this.esperandoClickZona = false;
    this.limpiarPreview();
    this.nuevaZona = { nombre: '', nivel: 'Alto', lat: 0, lng: 0, radio: 300 };
  }

  // ── Guardar zona vía API ────────────────────────────────────
  guardarZona(): void {
    if (!this.nuevaZona.nombre || this.nuevaZona.lat === 0) return;

    const alertasEnZona = this.alertas.filter(a => {
      const dLat = Math.abs(a.lat - this.nuevaZona.lat);
      const dLng = Math.abs(a.lng - this.nuevaZona.lng);
      const gradosAprox = this.nuevaZona.radio / 111000;
      return dLat <= gradosAprox && dLng <= gradosAprox;
    }).length;

    const payload: Omit<ZonaManual, 'id'> = {
      nombre: this.nuevaZona.nombre,
      nivel: this.nuevaZona.nivel,
      metodo: this.modoZona,
      radio: this.modoZona === 'area' ? this.nuevaZona.radio : undefined,
      centroLat: this.nuevaZona.lat,
      centroLng: this.nuevaZona.lng,
      alertasEnZona,
    };

    this.riskZonesService.createZona(payload).subscribe({
      next: (zonaCreada) => {
        const color = this.colorPorNivel(zonaCreada.nivel);
        let capa: any;

        if (zonaCreada.metodo === 'area') {
          capa = L.circle(
            [zonaCreada.centroLat, zonaCreada.centroLng],
            { radius: zonaCreada.radio ?? 300, color, fillColor: color, fillOpacity: 0.2, weight: 2 }
          ).bindTooltip(`${zonaCreada.nombre} (${zonaCreada.nivel})`).addTo(this.mapa);
        } else {
          const svg = this.crearSvgPin(color);
          const icon = L.divIcon({ html: svg, className: '', iconSize: [32, 42], iconAnchor: [16, 42] });
          capa = L.marker([zonaCreada.centroLat, zonaCreada.centroLng], { icon })
            .bindTooltip(`⚠️ ${zonaCreada.nombre} (${zonaCreada.nivel})`).addTo(this.mapa);
        }

        this.capasZonas.set(zonaCreada.id, capa);
        this.zonasManuales.push(zonaCreada);
        this.zonasManuales.sort((a, b) => b.alertasEnZona - a.alertasEnZona);

        this.limpiarPreview();
        this.modalZona = false;
        this.nuevaZona = { nombre: '', nivel: 'Alto', lat: 0, lng: 0, radio: 300 };
      },
      error: (err) => console.error('Error guardando zona:', err)
    });
  }

  // ── Marcar zona caliente directamente desde el panel — vía API ──
  marcarZonaCaliente(z: ZonaCaliente): void {
    const radio = z.alertas >= 5 ? 400 : z.alertas >= 3 ? 280 : 180;

    const payload: Omit<ZonaManual, 'id'> = {
      nombre: z.nombre,
      nivel: z.nivel,
      metodo: 'area',
      radio,
      centroLat: z.lat,
      centroLng: z.lng,
      alertasEnZona: z.alertas,
    };

    this.riskZonesService.createZona(payload).subscribe({
      next: (zonaCreada) => {
        const color = this.colorPorNivel(zonaCreada.nivel);
        const capa = L.circle(
          [zonaCreada.centroLat, zonaCreada.centroLng],
          { radius: zonaCreada.radio, color, fillColor: color, fillOpacity: 0.25, weight: 2 }
        ).bindTooltip(`${zonaCreada.nombre} (${zonaCreada.nivel})`).addTo(this.mapa);

        this.capasZonas.set(zonaCreada.id, capa);
        this.zonasManuales.push(zonaCreada);
        this.zonasManuales.sort((a, b) => b.alertasEnZona - a.alertasEnZona);
        this.mapa?.flyTo([zonaCreada.centroLat, zonaCreada.centroLng], 15, { duration: 0.6 });
      },
      error: (err) => console.error('Error marcando zona caliente:', err)
    });
  }

  // ── Eliminar zona vía API ────────────────────────────────────
  eliminarZona(id: number): void {
    this.riskZonesService.deleteZona(id).subscribe({
      next: () => {
        const capa = this.capasZonas.get(id);
        if (capa) this.mapa?.removeLayer(capa);
        this.capasZonas.delete(id);
        this.zonasManuales = this.zonasManuales.filter(z => z.id !== id);
      },
      error: (err) => console.error('Error eliminando zona:', err)
    });
  }

  // ── CAI / Hospital ───────────────────────────────────────────
  agregarPuntoCAI(): void {
    this.fabOpen = false;
    this.nuevoPunto = { tipo: 'CAI', nombre: '', lat: 0, lng: 0 };
    this.esperandoClickPunto = true;
    this.modalPunto = true;
  }

  // ── Guardar punto vía API ────────────────────────────────────
  guardarPunto(): void {
    if (!this.nuevoPunto.nombre) return;

    const payload: Omit<PuntoMapa, 'id'> = {
      tipo: this.nuevoPunto.tipo as 'CAI' | 'Hospital',
      nombre: this.nuevoPunto.nombre,
      lat: this.nuevoPunto.lat || 4.7110,
      lng: this.nuevoPunto.lng || -74.0721,
    };

    this.riskZonesService.createPunto(payload).subscribe({
      next: (puntoCreado) => {
        this.puntosMapa.push(puntoCreado);
        this.pintarUnPunto(puntoCreado);
        this.modalPunto = false;
        this.esperandoClickPunto = false;
      },
      error: (err) => console.error('Error guardando punto:', err)
    });
  }

  // ── Helpers iconos ────────────────────────────────────────────
  private colorPorNivel(nivel: 'Alto' | 'Medio' | 'Bajo'): string {
    return nivel === 'Alto' ? '#ef4444' : nivel === 'Medio' ? '#f97316' : '#eab308';
  }

  private crearSvgPin(color: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26S32 28 32 16C32 7.16 24.84 0 16 0z"
            fill="${color}" stroke="white" stroke-width="1.5"/>
      <path d="M16 9 L23 23 L9 23 Z" fill="white" fill-opacity="0.9"/>
      <rect x="15" y="14" width="2" height="5" fill="${color}"/>
      <rect x="15" y="20" width="2" height="2" fill="${color}"/>
    </svg>`;
  }

  private crearIconoPin(tipo: string): any {
    const colores: Record<string, string> = {
      SOS: '#ef4444', Medical: '#3b82f6', Robo: '#f59e0b', Acoso: '#8b5cf6',
    };
    const color = colores[tipo] ?? '#ef4444';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z"
            fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="14" cy="14" r="6" fill="white" fill-opacity="0.9"/>
    </svg>`;
    return L.divIcon({ html: svg, className: '', iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -36] });
  }

  // ── Pintar capas ─────────────────────────────────────────────
  private pintarAlertas(): void {
    this.alertas.forEach(a => {
      const marker = L.marker([a.lat, a.lng], { icon: this.crearIconoPin(a.tipo) }).addTo(this.mapa);
      marker.on('click', () => this.seleccionarAlerta(a));
      this.marcadoresAlertas.set(a.id, marker);
    });
  }

  private pintarPuntos(): void {
    this.puntosMapa.forEach(p => this.pintarUnPunto(p));
  }

  private pintarUnPunto(p: PuntoMapa): void {
    const emoji = p.tipo === 'CAI' ? '🚔' : '🏥';
    const bg    = p.tipo === 'CAI' ? '#dbeafe' : '#dcfce7';
    const icon  = L.divIcon({
      html: `<div style="width:32px;height:32px;border-radius:50%;background:${bg};
                         border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2);
                         display:flex;align-items:center;justify-content:center;font-size:1rem;">${emoji}</div>`,
      className: '', iconSize: [32, 32], iconAnchor: [16, 16],
    });
    const m = L.marker([p.lat, p.lng], { icon })
      .bindTooltip(p.nombre, { permanent: false, direction: 'top' })
      .addTo(this.mapa);
    this.marcadoresPuntos.push({ marker: m, tipo: p.tipo });
  }

  private pintarCalor(): void {
    this.zonasCalientes.forEach(z => {
      const radio = z.alertas >= 5 ? 350 : z.alertas >= 3 ? 250 : 180;
      const color = this.colorPorNivel(z.nivel);
      const c = L.circle([z.lat, z.lng], { radius: radio, color, fillColor: color, fillOpacity: 0.15, weight: 1 })
        .addTo(this.mapa);
      this.circulosCalor.push(c);
    });
  }

  // ── Seleccionar / deseleccionar alerta ────────────────────────
  seleccionarAlerta(alerta: Alerta): void {
    this.alertaActiva = alerta;
    this.mapa?.flyTo([alerta.lat, alerta.lng], 17, { duration: 0.7 });
    this.marcadoresAlertas.forEach((m, id) => m.setOpacity(id === alerta.id ? 1 : 0.45));
  }

  cerrarPopup(): void {
    this.alertaActiva = null;
    this.marcadoresAlertas.forEach(m => m.setOpacity(1));
  }

  irAZona(lat: number, lng: number): void {
    this.mapa?.flyTo([lat, lng], 15, { duration: 0.7 });
  }

  /** Solo resetea el zoom — nunca borra alertas ni datos */
  limpiarVista(): void {
    this.fabOpen = false;
    this.cerrarPopup();
    this.mapa?.flyTo([4.7110, -74.0721], 14);
  }

  // ── Filtros ──────────────────────────────────────────────────
  filtrarAlertas(): void {
    this.alertasFiltradas = this.alertas.filter(a => {
      const t = this.filtroTipo   === 'Todos' || a.tipo   === this.filtroTipo;
      const e = this.filtroEstado === 'Todos' || a.estado === this.filtroEstado;
      return t && e;
    });
  }

  // ── Atender alerta vía API ────────────────────────────────────
  atenderAlerta(alerta: Alerta): void {
    const nuevoEstado: 'Pendiente' | 'Atendida' =
      alerta.estado === 'Atendida' ? 'Pendiente' : 'Atendida';
    const alertaActualizada = { ...alerta, estado: nuevoEstado };

    this.alertsService.update(alertaActualizada).subscribe({
      next: () => {
        alerta.estado = nuevoEstado;
        const m = this.marcadoresAlertas.get(alerta.id);
        if (m) m.setOpacity(alerta.estado === 'Atendida' ? 0.4 : 1);
        this.filtrarAlertas();
      },
      error: (err) => console.error('Error actualizando alerta:', err)
    });
  }

  // ── Toggle capas ─────────────────────────────────────────────
  toggleCapa(capa: keyof typeof this.capas): void {
    if (!this.mapa) return;
    if (capa === 'alertas') {
      this.marcadoresAlertas.forEach(m =>
        this.capas.alertas ? m.addTo(this.mapa) : this.mapa.removeLayer(m));
    }
    if (capa === 'zonas') {
      this.capasZonas.forEach(p =>
        this.capas.zonas ? p.addTo(this.mapa) : this.mapa.removeLayer(p));
    }
    if (capa === 'cais' || capa === 'hospitales') {
      const tipo = capa === 'cais' ? 'CAI' : 'Hospital';
      this.marcadoresPuntos.filter(mp => mp.tipo === tipo).forEach(mp =>
        this.capas[capa] ? mp.marker.addTo(this.mapa) : this.mapa.removeLayer(mp.marker));
    }
    if (capa === 'calor') {
      this.circulosCalor.forEach(c =>
        this.capas.calor ? c.addTo(this.mapa) : this.mapa.removeLayer(c));
    }
  }
}