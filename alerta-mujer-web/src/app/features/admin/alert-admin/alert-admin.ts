import { Component, OnDestroy, AfterViewInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { AlertsService, AdminAlertDetail } from '../../../core/services/alerts.services';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { RiskZonesService, countAlertsInZones, isInsideZone } from '../../../core/services/risk-zones.services';
import { Alert, ActivationMethod } from '../../../core/models/alert.model';
import { ManualZone, HotZone, MapPoint, PointType, POINT_TYPES, PointLayer } from '../../../core/models/zona.model';
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
  private geocoding = inject(GeocodingService);

  // Detalle de la alerta elegida: última ubicación, dirección y envío a cada contacto
  detail: AdminAlertDetail | null = null;
  loadingDetail = false;
  alertAddress: string | null = null;
  private riskZonesService = inject(RiskZonesService);
  private cdr = inject(ChangeDetectorRef);

  // ── Mapa ─────────────────────────────────────────────────────
  private map: any;
  private alertMarkers: Map<number, any> = new Map();
  private pointMarkers: { marker: any; layer: PointLayer }[] = [];
  private zoneLayers: Map<number, any> = new Map();
  private heatCircles: any[] = [];

  private previewCircle: any = null;
  private centerMarker: any = null;

  private readonly initialCenter: [number, number] = [4.7110, -74.0721];

  // ── UI state ─────────────────────────────────────────────────
  activeTab: 'alertas' | 'zonas' = 'alertas';
  fabOpen = false;
  filtersOpen = true;
  zoneModal = false;
  pointModal = false;
  loading = true;

  activeAlert: Alert | null = null;
  methodFilter  = 'Todos';
  statusFilter = 'Todos';
  levelFilter  = 'Todos';
  filteredAlerts: Alert[] = [];

  layers = { alerts: true, zones: true, cais: true, hospitals: true, support: true, heat: true };
  alertSearch = '';
  readonly pointTypes = Object.entries(POINT_TYPES) as [PointType, (typeof POINT_TYPES)[PointType]][];

  // ── Modal zona ───────────────────────────────────────────────
  zoneMode: 'pin' | 'area' = 'area';
  waitingZoneClick = false;

  newZone = {
    nombre: '',
    level: 'Alto' as 'Alto' | 'Medio' | 'Bajo',
    lat: 0,
    lng: 0,
    radio: 300,
  };

  riskLevels: { value: 'Alto' | 'Medio' | 'Bajo'; label: string }[] = [
    { value: 'Alto',  label: 'Alto'  },
    { value: 'Medio', label: 'Medio' },
    { value: 'Bajo',  label: 'Bajo'  },
  ];

  levelFilters = [
    { value: 'Todos', label: 'Todas'    },
    { value: 'Alto',  label: 'Alto'  },
    { value: 'Medio', label: 'Medio' },
    { value: 'Bajo',  label: 'Bajo'  },
  ];

  // ── Modal punto CAI/Hospital ──────────────────────────────────
  newPoint: { tipo: PointType; nombre: string; lat: number; lng: number } = { tipo: 'police_post', nombre: '', lat: 0, lng: 0 };
  waitingPointClick = false;

  // ── Datos — vienen vía API ─────────────────────
  alerts: Alert[] = [];
  manualZones: ManualZone[] = [];
  mapPoints: MapPoint[] = [];

  // ── Filtros ──────────────────────────────────────────────────
  filterAlerts(): void {
    const term = this.alertSearch.trim().toLowerCase();
    this.filteredAlerts = this.alerts.filter(a => {
      const m = this.methodFilter  === 'Todos' || a.activationMethod === this.methodFilter;
      const e = this.statusFilter === 'Todos' || a.estado          === this.statusFilter;
      // Búsqueda por nombre, descripción, lugar o número de alerta
      const b = !term || [a.nombre, a.description, a.location, `#${a.id}`]
        .some(t => (t ?? '').toString().toLowerCase().includes(term));
      return m && e && b;
    });
  }

  // ── Getters ──────────────────────────────────────────────────
  get pendingAlerts(): number {
    return this.alerts.filter(a => a.estado === 'Pendiente').length;
  }

  get hotZones(): HotZone[] {
    const groups: HotZone[] = [];
    const processed = new Set<number>();

    this.alerts.forEach(a => {
      if (processed.has(a.id)) return;
      const nearby = this.alerts.filter(b =>
        !processed.has(b.id) &&
        Math.abs(b.lat - a.lat) < 0.004 &&
        Math.abs(b.lng - a.lng) < 0.004
      );
      if (nearby.length >= 2) {
        nearby.forEach(b => processed.add(b.id));
        const lat = nearby.reduce((s, b) => s + b.lat, 0) / nearby.length;
        const lng = nearby.reduce((s, b) => s + b.lng, 0) / nearby.length;
        const level: 'Alto' | 'Medio' | 'Bajo' =
          nearby.length >= 5 ? 'Alto' : nearby.length >= 3 ? 'Medio' : 'Bajo';
        groups.push({ nombre: `Zona ${a.location}`, lat, lng, alerts: nearby.length, level });
      }
    });

    return groups.sort((a, b) => b.alerts - a.alerts);
  }

  get filteredManualZones(): ManualZone[] {
    if (this.levelFilter === 'Todos') return this.manualZones;
    return this.manualZones.filter(z => z.level === this.levelFilter);
  }

  // ── Lifecycle ────────────────────────────────────────────────
  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initMapAndData();
    }, 150);
  }

  ngOnDestroy(): void { if (this.map) this.map.remove(); }

  /** Fuerza refresco de la vista (útil para callbacks de Leaflet y HTTP) */
  private refresh(): void {
    this.cdr.detectChanges();
  }

  // ── Medio de activación ──────────────────────────────────────
  /** Clase CSS segura (sin tildes ni espacios) */
  methodClass(method: ActivationMethod): string {
    const map: Record<ActivationMethod, string> = {
      'Botón de pánico':       'boton',
      'Contacto':              'manual',
      'Widget':                'widget',
      'Movimiento sospechoso': 'movimiento',
      'Botón de encendido':    'movimiento',
      'Manual':                'manual',
    };
    return map[method] ?? 'boton';
  }

  // ── Init mapa + carga de datos reales ──────────────────────────
  private initMapAndData(): void {
    if (typeof L === 'undefined') {
      console.warn('Leaflet no cargado — agrega el CDN en index.html');
      return;
    }

    this.map = L.map('mapa-leaflet', { center: this.initialCenter, zoom: 14 });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(this.map);

    this.map.on('click', (e: any) => this.onMapClick(e));

    this.loading = true;
    forkJoin({
      alerts: this.alertsService.getAll(),
      zones: this.riskZonesService.getZones(),
      puntos: this.riskZonesService.getPoints(),
    }).subscribe({
      next: ({ alerts, zones, puntos }) => {
        // DEBUG: quítalo cuando ya veas bien los datos

        this.alerts = alerts;
        this.manualZones = countAlertsInZones(zones, alerts);
        this.mapPoints = puntos;
        this.filterAlerts();

        this.paintAlerts();
        this.paintPoints();
        this.paintHeat();
        this.repaintSavedZones();

        this.loading = false;
        this.refresh();
        setTimeout(() => this.map?.invalidateSize(), 200);
      },
      error: (err) => {
        console.error('Error cargando datos del mapa:', err);
        this.loading = false;
        this.refresh();
      }
    });
  }

  // ── Pintar capas ──────────────────────────────────────────────
  private validCoords(lat: number, lng: number): boolean {
    return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  }

  private paintAlerts(): void {
    this.alertMarkers.forEach(m => this.map?.removeLayer(m));
    this.alertMarkers.clear();

    this.alerts.forEach(a => {
      if (!this.validCoords(a.lat, a.lng)) return;

      const marker = L.marker([a.lat, a.lng], {
        icon: this.createPinIcon(a.activationMethod, a.estado === 'Atendida'),
      }).bindTooltip(`${a.nombre}`);

      marker.on('click', () => {
        this.selectAlert(a);
        this.refresh();
      });

      this.alertMarkers.set(a.id, marker);
      if (this.layers.alerts) marker.addTo(this.map);
    });
  }

  private paintPoints(): void {
    this.mapPoints.forEach(p => this.paintOnePoint(p));
  }

  private paintOnePoint(p: MapPoint): void {
    if (!this.validCoords(p.lat, p.lng)) return;

    const { emoji, background, label, layer } = POINT_TYPES[p.tipo];

    const icon = L.divIcon({
      html: `<div style="width:30px;height:30px;border-radius:50%;background:${background};
                         border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);
                         display:flex;align-items:center;justify-content:center;font-size:15px;">${emoji}</div>`,
      className: '',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });

    const marker = L.marker([p.lat, p.lng], { icon }).bindTooltip(`${emoji} ${p.nombre} · ${label}`);
    this.pointMarkers.push({ marker, layer });

    if (this.layers[layer]) marker.addTo(this.map);
  }

  private paintHeat(): void {
    this.heatCircles.forEach(c => this.map?.removeLayer(c));
    this.heatCircles = [];

    this.hotZones.forEach(z => {
      const color = this.colorByLevel(z.level);
      const circle = L.circle([z.lat, z.lng], {
        radius: 150 + z.alerts * 60,
        color,
        fillColor: color,
        fillOpacity: 0.15,
        weight: 0,
        interactive: false,
      });
      this.heatCircles.push(circle);
      if (this.layers.heat) circle.addTo(this.map);
    });
  }

  private repaintSavedZones(): void {
    this.manualZones.forEach(z => {
      const layer = this.paintZoneOnMap(z);
      this.zoneLayers.set(z.id, layer);
      if (!this.layers.zones) this.map?.removeLayer(layer);
    });
  }

  // ── Capas (toggle) ────────────────────────────────────────────
  toggleLayer(layer: 'alerts' | 'zones' | 'heat' | PointLayer): void {
    if (!this.map) return;
    const visible = this.layers[layer];
    const toggle = (layer: any) => visible ? layer.addTo(this.map) : this.map.removeLayer(layer);

    switch (layer) {
      case 'alerts':
        this.alertMarkers.forEach(toggle);
        break;
      case 'zones':
        this.zoneLayers.forEach(toggle);
        break;
      case 'cais':
      case 'hospitals':
      case 'support':
        this.pointMarkers.filter(p => p.layer === layer).forEach(p => toggle(p.marker));
        break;
      case 'heat':
        this.heatCircles.forEach(toggle);
        break;
    }
  }

  // ── Selección / atención de alertas ───────────────────────────
  selectAlert(alert: Alert): void {
    this.activeAlert = alert;
    if (this.validCoords(alert.lat, alert.lng)) {
      this.map?.flyTo([alert.lat, alert.lng], 16, { duration: 0.6 });
    }
    this.loadDetail(alert);
  }

  private loadDetail(alert: Alert): void {
    this.detail = null;
    this.alertAddress = null;
    this.loadingDetail = true;
    this.alertsService.adminDetail(alert.id).subscribe({
      next: (d) => {
        if (this.activeAlert?.id !== alert.id) return;
        this.detail = d;
        this.loadingDetail = false;
        // La dirección es la de la última ubicación conocida o, si no hay, la de la activación
        const point = d.ultimaUbicacion ?? (d.ubicacionVisible && this.validCoords(alert.lat, alert.lng) ? alert : null);
        if (point) {
          this.geocoding.get(point.lat, point.lng).then((l) => {
            if (this.activeAlert?.id !== alert.id || !l) return;
            this.alertAddress = [l.neighborhood, l.address].filter(Boolean).join(' · ') || l.city;
            this.refresh();
          });
        }
        this.refresh();
      },
      error: () => {
        this.loadingDetail = false;
        this.refresh();
      },
    });
  }

  /** "Correo · enviado", "Push · falló"... */
  channelText(channel: string, estado: string): string {
    const nombre = channel === 'email' ? 'Correo' : channel === 'push' ? 'Notificación' : channel;
    const statuses: Record<string, string> = { sent: 'enviado', delivered: 'entregado', failed: 'falló', pending: 'pendiente' };
    return `${nombre} · ${statuses[estado] ?? estado}`;
  }

  howLongAgo(fecha: Date | null): string {
    if (!fecha) return '—';
    const min = Math.round((Date.now() - fecha.getTime()) / 60000);
    if (min < 1) return 'hace un momento';
    if (min < 60) return `hace ${min} min`;
    if (min < 1440) return `hace ${Math.floor(min / 60)} h`;
    return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  }

  closePopup(): void {
    this.activeAlert = null;
  }

  attendAlert(alert: Alert): void {
    if (alert.estado === 'Atendida') return;

    this.alertsService.updateStatus(alert.id, 'Atendida').subscribe({
      next: () => {
        alert.estado = 'Atendida';
        this.alertMarkers.get(alert.id)
          ?.setIcon(this.createPinIcon(alert.activationMethod, true));
        this.filterAlerts();
        this.refresh();
      },
      error: (err) => console.error('Error atendiendo alerta:', err),
    });
  }

  goToZone(lat: number, lng: number): void {
    this.map?.flyTo([lat, lng], 15, { duration: 0.6 });
  }

  clearView(): void {
    this.fabOpen = false;
    this.activeAlert = null;
    this.map?.flyTo(this.initialCenter, 14, { duration: 0.6 });
  }

  // ── Click en mapa ────────────────────────────────────────────
  private onMapClick(e: any): void {
    const { lat, lng } = e.latlng;

    if (this.zoneModal && this.waitingZoneClick) {
      this.newZone.lat = parseFloat(lat.toFixed(6));
      this.newZone.lng = parseFloat(lng.toFixed(6));
      this.waitingZoneClick = false;
      this.updateZonePreview();
      this.refresh();
      return;
    }

    if (this.pointModal && this.waitingPointClick) {
      this.newPoint.lat = parseFloat(lat.toFixed(6));
      this.newPoint.lng = parseFloat(lng.toFixed(6));
      this.waitingPointClick = false; // vuelve a mostrarse el modal con la ubicación elegida
      this.refresh();
    }
  }

  // ── Preview círculo en mapa al elegir área ────────────────────
  updateZonePreview(): void {
    if (!this.map || this.newZone.lat === 0) return;

    this.clearPreview();

    if (this.zoneMode === 'area') {
      const color = this.colorByLevel(this.newZone.level);
      this.previewCircle = L.circle(
        [this.newZone.lat, this.newZone.lng],
        { radius: this.newZone.radio, color, fillColor: color, fillOpacity: 0.2, weight: 2, dashArray: '6,4' }
      ).addTo(this.map);
    }

    this.centerMarker = L.circleMarker(
      [this.newZone.lat, this.newZone.lng],
      { radius: 6, fillColor: this.colorByLevel(this.newZone.level), color: '#fff', weight: 2, fillOpacity: 1 }
    ).addTo(this.map);

    this.map.flyTo([this.newZone.lat, this.newZone.lng], 15, { duration: 0.5 });
  }

  private clearPreview(): void {
    if (this.previewCircle)  { this.map?.removeLayer(this.previewCircle);  this.previewCircle  = null; }
    if (this.centerMarker)  { this.map?.removeLayer(this.centerMarker);  this.centerMarker  = null; }
  }

  // ── Abrir modal zona nueva ────────────────────────────────────
  openZoneModal(mode: 'pin' | 'area' = 'area'): void {
    this.fabOpen = false;
    this.zoneMode = mode;
    this.newZone = { nombre: '', level: 'Alto', lat: 0, lng: 0, radio: 300 };
    this.waitingZoneClick = false;
    this.clearPreview();
    this.zoneModal = true;
    this.activeTab = 'zonas';
  }

  enableMapClick(): void {
    this.waitingZoneClick = true;
  }

  setLevel(value: 'Alto' | 'Medio' | 'Bajo'): void {
    this.newZone.level = value;
    if (this.newZone.lat !== 0) this.updateZonePreview();
  }

  onRadioChange(): void {
    if (this.newZone.lat !== 0) this.updateZonePreview();
  }

  cancelZoneModal(): void {
    this.zoneModal = false;
    this.waitingZoneClick = false;
    this.clearPreview();
    this.newZone = { nombre: '', level: 'Alto', lat: 0, lng: 0, radio: 300 };
  }

  // ── Guardar zona vía API ────────────────────────────────────
  saveZone(): void {
    if (!this.newZone.nombre || this.newZone.lat === 0) return;

    const tempZone = {
      centerLat: this.newZone.lat,
      centerLng: this.newZone.lng,
      radio: this.zoneMode === 'area' ? this.newZone.radio : undefined,
    } as ManualZone;
    const alertsInZone = this.alerts.filter(a => isInsideZone(tempZone, a.lat, a.lng)).length;

    const payload: Omit<ManualZone, 'id'> = {
      nombre: this.newZone.nombre,
      level: this.newZone.level,
      method: this.zoneMode,
      radio: this.zoneMode === 'area' ? this.newZone.radio : undefined,
      centerLat: this.newZone.lat,
      centerLng: this.newZone.lng,
      alertsInZone,
    };

    this.riskZonesService.createZone(payload).subscribe({
      next: (createdZone) => {
        const layer = this.paintZoneOnMap(createdZone);
        this.zoneLayers.set(createdZone.id, layer);
        this.manualZones.push(createdZone);
        this.manualZones.sort((a, b) => b.alertsInZone - a.alertsInZone);

        this.clearPreview();
        this.zoneModal = false;
        this.newZone = { nombre: '', level: 'Alto', lat: 0, lng: 0, radio: 300 };
        this.refresh();
      },
      error: (err) => console.error('Error guardando zona:', err)
    });
  }

  // ── Marcar zona caliente directamente desde el panel — vía API ──
  markHotZone(z: HotZone): void {
    const radio = z.alerts >= 5 ? 400 : z.alerts >= 3 ? 280 : 180;

    const payload: Omit<ManualZone, 'id'> = {
      nombre: z.nombre,
      level: z.level,
      method: 'area',
      radio,
      centerLat: z.lat,
      centerLng: z.lng,
      alertsInZone: z.alerts,
    };

    this.riskZonesService.createZone(payload).subscribe({
      next: (createdZone) => {
        const layer = this.paintZoneOnMap(createdZone);
        this.zoneLayers.set(createdZone.id, layer);
        this.manualZones.push(createdZone);
        this.manualZones.sort((a, b) => b.alertsInZone - a.alertsInZone);
        this.map?.flyTo([createdZone.centerLat, createdZone.centerLng], 15, { duration: 0.6 });
        this.refresh();
      },
      error: (err) => console.error('Error marcando zona caliente:', err)
    });
  }

  // ── Eliminar zona vía API ────────────────────────────────────
  deleteZone(id: number): void {
    this.riskZonesService.deleteZone(id).subscribe({
      next: () => {
        const layer = this.zoneLayers.get(id);
        if (layer) this.map?.removeLayer(layer);
        this.zoneLayers.delete(id);
        this.manualZones = this.manualZones.filter(z => z.id !== id);
        this.refresh();
      },
      error: (err) => console.error('Error eliminando zona:', err)
    });
  }

  // ── CAI / Hospital ───────────────────────────────────────────
  addCaiPoint(): void {
    this.fabOpen = false;
    this.newPoint = { tipo: 'police_post', nombre: '', lat: 0, lng: 0 };
    this.waitingPointClick = true;
    this.pointModal = true;
  }

  // ── Guardar punto vía API ────────────────────────────────────
  savePoint(): void {
    if (!this.newPoint.nombre) return;

    const payload: Omit<MapPoint, 'id'> = {
      tipo: this.newPoint.tipo,
      nombre: this.newPoint.nombre,
      lat: this.newPoint.lat || this.initialCenter[0],
      lng: this.newPoint.lng || this.initialCenter[1],
    };

    this.riskZonesService.createPoint(payload).subscribe({
      next: (createdPoint) => {
        this.mapPoints.push(createdPoint);
        this.paintOnePoint(createdPoint);
        this.pointModal = false;
        this.waitingPointClick = false;
        this.refresh();
      },
      error: (err) => console.error('Error guardando punto:', err)
    });
  }

  // ── Helpers iconos / zonas ────────────────────────────────────
  private colorByLevel(level: 'Alto' | 'Medio' | 'Bajo'): string {
    return level === 'Alto' ? '#d946ef' : level === 'Medio' ? '#a855f7' : '#c084fc';
  }

  /**
   * Único punto de verdad para pintar una ZonaManual en el mapa
   * (se usaba duplicado en repintarZonasGuardadas, guardarZona y marcarZonaCaliente)
   */
  private paintZoneOnMap(zone: ManualZone): any {
    const color = this.colorByLevel(zone.level);

    const icon = L.divIcon({ html: this.createPinSvg(color), className: '', iconSize: [32, 42], iconAnchor: [16, 42] });
    const pin = L.marker([zone.centerLat, zone.centerLng], { icon }).bindTooltip(`⚠️ ${zone.nombre} (${zone.level})`);

    if (zone.method === 'area') {
      // El área lleva también el pin de peligro en su centro, para verla aunque el mapa esté alejado
      const circle = L.circle(
        [zone.centerLat, zone.centerLng],
        { radius: zone.radio ?? 300, color, fillColor: color, fillOpacity: 0.2, weight: 2 }
      ).bindTooltip(`${zone.nombre} (${zone.level})`);
      return L.layerGroup([circle, pin]).addTo(this.map);
    }

    return pin.addTo(this.map);
  }

  private createPinSvg(color: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26S32 28 32 16C32 7.16 24.84 0 16 0z"
            fill="${color}" stroke="white" stroke-width="1.5"/>
      <path d="M16 9 L23 23 L9 23 Z" fill="white" fill-opacity="0.9"/>
      <rect x="15" y="14" width="2" height="5" fill="${color}"/>
      <rect x="15" y="20" width="2" height="2" fill="${color}"/>
    </svg>`;
  }

  // Color del pin según el medio de activación (gris si ya fue atendida)
  private createPinIcon(method: ActivationMethod, attended = false): any {
    const colors: Record<ActivationMethod, string> = {
      'Botón de pánico':       '#d946ef',
      'Contacto':              '#d946ef',
      'Widget':                '#6d28d9',
      'Movimiento sospechoso': '#8b5cf6',
      'Botón de encendido':    '#a855f7',
      'Manual':                '#9333ea',
    };

    const color = attended ? '#9ca3af' : (colors[method] ?? '#d946ef');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z"
            fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="14" cy="14" r="5" fill="white"/>
    </svg>`;

    return L.divIcon({ html: svg, className: '', iconSize: [28, 36], iconAnchor: [14, 36] });
  }
}