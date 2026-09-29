import { Component, OnDestroy, AfterViewInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { AlertsService } from '../../../core/services/alerts.services';
import { RiskZonesService } from '../../../core/services/risk-zones.services';
import { Alerta, MedioActivacion } from '../../../core/models/alert.model';
import { ZonaManual, ZonaCaliente, PuntoMapa } from '../../../core/models/zona.model';
import { Modal } from '../../../shared/components/modal/modal';
import { Chip } from '../../../shared/components/chip/chip';

declare const L: any;

@Component({
  selector: 'app-alert-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, Modal, Chip],
  templateUrl: './alert-admin.html',
  styleUrl: './alert-admin.scss',
})
export class AlertAdminComponent implements AfterViewInit, OnDestroy {

  private alertsService = inject(AlertsService);
  private riskZonesService = inject(RiskZonesService);
  private cdr = inject(ChangeDetectorRef);

  // ── Mapa ─────────────────────────────────────────────────────
  private mapa: any;
  private marcadoresAlertas: Map<number, any> = new Map();
  private marcadoresPuntos: { marker: any; tipo: string }[] = [];
  private capasZonas: Map<number, any> = new Map();
  private circulosCalor: any[] = [];

  private circuloPreview: any = null;
  private marcadorCentro: any = null;

  private readonly centroInicial: [number, number] = [4.7110, -74.0721];

  // ── UI state ─────────────────────────────────────────────────
  tabActivo: 'alertas' | 'zonas' = 'alertas';
  fabOpen = false;
  filtrosOpen = true;
  modalZona = false;
  modalPunto = false;
  cargando = true;

  alertaActiva: Alerta | null = null;
  filtroMedio  = 'Todos';
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

  // ── Datos — vienen vía API ─────────────────────
  alertas: Alerta[] = [];
  zonasManuales: ZonaManual[] = [];
  puntosMapa: PuntoMapa[] = [];

  // ── Filtros ──────────────────────────────────────────────────
  filtrarAlertas(): void {
    this.alertasFiltradas = this.alertas.filter(a => {
      const m = this.filtroMedio  === 'Todos' || a.medioActivacion === this.filtroMedio;
      const e = this.filtroEstado === 'Todos' || a.estado          === this.filtroEstado;
      return m && e;
    });
  }

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

  /** Fuerza refresco de la vista (útil para callbacks de Leaflet y HTTP) */
  private refrescar(): void {
    this.cdr.detectChanges();
  }

  // ── Medio de activación ──────────────────────────────────────
  /** Clase CSS segura (sin tildes ni espacios) */
  claseMedio(medio: MedioActivacion): string {
    const map: Record<MedioActivacion, string> = {
      'Botón de pánico':       'boton',
      'Widget':                'widget',
      'Movimiento sospechoso': 'movimiento',
      'Manual':                'manual',
    };
    return map[medio] ?? 'boton';
  }

  // ── Init mapa + carga de datos reales ──────────────────────────
  private initMapaYData(): void {
    if (typeof L === 'undefined') {
      console.warn('Leaflet no cargado — agrega el CDN en index.html');
      return;
    }

    this.mapa = L.map('mapa-leaflet', { center: this.centroInicial, zoom: 14 });

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
        // DEBUG: quítalo cuando ya veas bien los datos
        console.log('Primera alerta normalizada:', alertas[0]);

        this.alertas = alertas;
        this.zonasManuales = zonas;
        this.puntosMapa = puntos;
        this.alertasFiltradas = [...this.alertas];

        this.pintarAlertas();
        this.pintarPuntos();
        this.pintarCalor();
        this.repintarZonasGuardadas();

        this.cargando = false;
        this.refrescar();
        setTimeout(() => this.mapa?.invalidateSize(), 200);
      },
      error: (err) => {
        console.error('Error cargando datos del mapa:', err);
        this.cargando = false;
        this.refrescar();
      }
    });
  }

  // ── Pintar capas ──────────────────────────────────────────────
  private coordsValidas(lat: number, lng: number): boolean {
    return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  }

  private pintarAlertas(): void {
    this.marcadoresAlertas.forEach(m => this.mapa?.removeLayer(m));
    this.marcadoresAlertas.clear();

    this.alertas.forEach(a => {
      if (!this.coordsValidas(a.lat, a.lng)) return;

      const marker = L.marker([a.lat, a.lng], {
        icon: this.crearIconoPin(a.medioActivacion, a.estado === 'Atendida'),
      }).bindTooltip(`${a.nombre}`);

      marker.on('click', () => {
        this.seleccionarAlerta(a);
        this.refrescar();
      });

      this.marcadoresAlertas.set(a.id, marker);
      if (this.capas.alertas) marker.addTo(this.mapa);
    });
  }

  private pintarPuntos(): void {
    this.puntosMapa.forEach(p => this.pintarUnPunto(p));
  }

  private pintarUnPunto(p: PuntoMapa): void {
    if (!this.coordsValidas(p.lat, p.lng)) return;

    const esCAI = p.tipo === 'CAI';
    const emoji = esCAI ? '🚔' : '🏥';
    const fondo = esCAI ? '#dbeafe' : '#fce7f3';

    const icon = L.divIcon({
      html: `<div style="width:30px;height:30px;border-radius:50%;background:${fondo};
                         border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);
                         display:flex;align-items:center;justify-content:center;font-size:15px;">${emoji}</div>`,
      className: '',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });

    const marker = L.marker([p.lat, p.lng], { icon }).bindTooltip(`${emoji} ${p.nombre}`);
    this.marcadoresPuntos.push({ marker, tipo: p.tipo });

    const visible = esCAI ? this.capas.cais : this.capas.hospitales;
    if (visible) marker.addTo(this.mapa);
  }

  private pintarCalor(): void {
    this.circulosCalor.forEach(c => this.mapa?.removeLayer(c));
    this.circulosCalor = [];

    this.zonasCalientes.forEach(z => {
      const color = this.colorPorNivel(z.nivel);
      const circulo = L.circle([z.lat, z.lng], {
        radius: 150 + z.alertas * 60,
        color,
        fillColor: color,
        fillOpacity: 0.15,
        weight: 0,
        interactive: false,
      });
      this.circulosCalor.push(circulo);
      if (this.capas.calor) circulo.addTo(this.mapa);
    });
  }

  private repintarZonasGuardadas(): void {
    this.zonasManuales.forEach(z => {
      const capa = this.pintarZonaEnMapa(z);
      this.capasZonas.set(z.id, capa);
      if (!this.capas.zonas) this.mapa?.removeLayer(capa);
    });
  }

  // ── Capas (toggle) ────────────────────────────────────────────
  toggleCapa(capa: 'alertas' | 'zonas' | 'cais' | 'hospitales' | 'calor'): void {
    if (!this.mapa) return;
    const visible = this.capas[capa];
    const alternar = (layer: any) => visible ? layer.addTo(this.mapa) : this.mapa.removeLayer(layer);

    switch (capa) {
      case 'alertas':
        this.marcadoresAlertas.forEach(alternar);
        break;
      case 'zonas':
        this.capasZonas.forEach(alternar);
        break;
      case 'cais':
        this.marcadoresPuntos.filter(p => p.tipo === 'CAI').forEach(p => alternar(p.marker));
        break;
      case 'hospitales':
        this.marcadoresPuntos.filter(p => p.tipo === 'Hospital').forEach(p => alternar(p.marker));
        break;
      case 'calor':
        this.circulosCalor.forEach(alternar);
        break;
    }
  }

  // ── Selección / atención de alertas ───────────────────────────
  seleccionarAlerta(alerta: Alerta): void {
    this.alertaActiva = alerta;
    if (this.coordsValidas(alerta.lat, alerta.lng)) {
      this.mapa?.flyTo([alerta.lat, alerta.lng], 16, { duration: 0.6 });
    }
  }

  cerrarPopup(): void {
    this.alertaActiva = null;
  }

  atenderAlerta(alerta: Alerta): void {
    if (alerta.estado === 'Atendida') return;

    this.alertsService.updateEstado(alerta.id, 'Atendida').subscribe({
      next: () => {
        alerta.estado = 'Atendida';
        this.marcadoresAlertas.get(alerta.id)
          ?.setIcon(this.crearIconoPin(alerta.medioActivacion, true));
        this.filtrarAlertas();
        this.refrescar();
      },
      error: (err) => console.error('Error atendiendo alerta:', err),
    });
  }

  irAZona(lat: number, lng: number): void {
    this.mapa?.flyTo([lat, lng], 15, { duration: 0.6 });
  }

  limpiarVista(): void {
    this.fabOpen = false;
    this.alertaActiva = null;
    this.mapa?.flyTo(this.centroInicial, 14, { duration: 0.6 });
  }

  // ── Click en mapa ────────────────────────────────────────────
  private onMapaClick(e: any): void {
    const { lat, lng } = e.latlng;

    if (this.modalZona && this.esperandoClickZona) {
      this.nuevaZona.lat = parseFloat(lat.toFixed(6));
      this.nuevaZona.lng = parseFloat(lng.toFixed(6));
      this.esperandoClickZona = false;
      this.actualizarPreviewZona();
      this.refrescar();
      return;
    }

    if (this.modalPunto && this.esperandoClickPunto) {
      this.nuevoPunto.lat = parseFloat(lat.toFixed(6));
      this.nuevoPunto.lng = parseFloat(lng.toFixed(6));
      this.refrescar();
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
        const capa = this.pintarZonaEnMapa(zonaCreada);
        this.capasZonas.set(zonaCreada.id, capa);
        this.zonasManuales.push(zonaCreada);
        this.zonasManuales.sort((a, b) => b.alertasEnZona - a.alertasEnZona);

        this.limpiarPreview();
        this.modalZona = false;
        this.nuevaZona = { nombre: '', nivel: 'Alto', lat: 0, lng: 0, radio: 300 };
        this.refrescar();
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
        const capa = this.pintarZonaEnMapa(zonaCreada);
        this.capasZonas.set(zonaCreada.id, capa);
        this.zonasManuales.push(zonaCreada);
        this.zonasManuales.sort((a, b) => b.alertasEnZona - a.alertasEnZona);
        this.mapa?.flyTo([zonaCreada.centroLat, zonaCreada.centroLng], 15, { duration: 0.6 });
        this.refrescar();
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
        this.refrescar();
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
      lat: this.nuevoPunto.lat || this.centroInicial[0],
      lng: this.nuevoPunto.lng || this.centroInicial[1],
    };

    this.riskZonesService.createPunto(payload).subscribe({
      next: (puntoCreado) => {
        this.puntosMapa.push(puntoCreado);
        this.pintarUnPunto(puntoCreado);
        this.modalPunto = false;
        this.esperandoClickPunto = false;
        this.refrescar();
      },
      error: (err) => console.error('Error guardando punto:', err)
    });
  }

  // ── Helpers iconos / zonas ────────────────────────────────────
  private colorPorNivel(nivel: 'Alto' | 'Medio' | 'Bajo'): string {
    return nivel === 'Alto' ? '#ef4444' : nivel === 'Medio' ? '#f97316' : '#eab308';
  }

  /**
   * Único punto de verdad para pintar una ZonaManual en el mapa
   * (se usaba duplicado en repintarZonasGuardadas, guardarZona y marcarZonaCaliente)
   */
  private pintarZonaEnMapa(zona: ZonaManual): any {
    const color = this.colorPorNivel(zona.nivel);

    if (zona.metodo === 'area') {
      return L.circle(
        [zona.centroLat, zona.centroLng],
        { radius: zona.radio ?? 300, color, fillColor: color, fillOpacity: 0.2, weight: 2 }
      ).bindTooltip(`${zona.nombre} (${zona.nivel})`).addTo(this.mapa);
    }

    const svg = this.crearSvgPin(color);
    const icon = L.divIcon({ html: svg, className: '', iconSize: [32, 42], iconAnchor: [16, 42] });
    return L.marker([zona.centroLat, zona.centroLng], { icon })
      .bindTooltip(`⚠️ ${zona.nombre} (${zona.nivel})`).addTo(this.mapa);
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

  // Color del pin según el medio de activación (gris si ya fue atendida)
  private crearIconoPin(medio: MedioActivacion, atendida = false): any {
    const colores: Record<MedioActivacion, string> = {
      'Botón de pánico':       '#ef4444',
      'Widget':                '#3b82f6',
      'Movimiento sospechoso': '#8b5cf6',
      'Manual':                '#f59e0b',
    };

    const color = atendida ? '#9ca3af' : (colores[medio] ?? '#ef4444');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z"
            fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="14" cy="14" r="5" fill="white"/>
    </svg>`;

    return L.divIcon({ html: svg, className: '', iconSize: [28, 36], iconAnchor: [14, 36] });
  }
}