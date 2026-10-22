import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, NgClass } from '@angular/common';
import * as L from 'leaflet';
import { AlertsService } from '../../../core/services/alerts.services';
import { Alert } from '../../../core/models/alert.model';
import { AuthService } from '../../../core/auth/auth.service';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { DatePicker } from '../../../shared/components/selector-fecha/selector-fecha';
import { compactPages } from '../../../shared/utils/paginacion';

const iconDefault = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Teselas de OpenStreetMap (las de CARTO ahora exigen clave y salían con "API KEY REQUIRED").
// En modo oscuro se oscurecen con un filtro CSS (clase tiles-oscuras en la capa).
const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '© OpenStreetMap contributors';

@Component({
  selector: 'app-alert-history',
  imports: [DatePicker, CommonModule, NgClass],
  templateUrl: './alert-history.html',
  styleUrl: './alert-history.scss',
})
export class AlertHistory implements OnInit, OnDestroy {

  private alertsService = inject(AlertsService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private geocoding = inject(GeocodingService);
  private cdr = inject(ChangeDetectorRef);

  alerts: Alert[] = [];
  filteredAlerts: Alert[] = [];
  error = false;

  // Fecha elegida en el selector (formato 'YYYY-MM-DD' del <input type="date">), o null si no hay filtro.
  dateFilter: string | null = null;

  // Filtro por medio de activación ('Todas' = sin filtro).
  typeFilter = 'Todas';
  searchTerm = '';

  // NOTA: estos 4 valores deben coincidir exactamente con los que envía el backend
  // en Alerta.medioActivacion. Ajusta la lista si tus nombres reales son distintos.
  availableMethods = ['Botón de pánico', 'Contacto', 'Widget', 'Movimiento sospechoso', 'Botón de encendido', 'Manual'];


  totalAlertCount = 0;
  alertsThisMonth = 0;
  attendedAlerts = 0;
  cancelledAlerts = 0;

  methodBadge: Record<string, string> = {
    'Botón de pánico': 'badge-boton',
    'Contacto': 'badge-manual',
    'Widget': 'badge-widget',
    'Movimiento sospechoso': 'badge-movimiento',
    'Botón de encendido': 'badge-movimiento',
    'Manual': 'badge-manual',
  };

  statusBadge: Record<string, string> = {
    'Atendida': 'badge-ok',
    'Pendiente': 'badge-pendiente',
    'Cancelada': 'badge-falsa',
  };

  // Fila expandida in-line (reemplaza al modal). Solo una a la vez.
  expandedAlertId: number | null = null;
  openMenuId: number | null = null;

  // Paginación
  currentPage = 1;
  pageSize = 7;

  private map: L.Map | null = null;
  private tileLayer: L.TileLayer | null = null;
  private currentMapElId: string | null = null;
  // Vigila cambios de tema (clase/atributo en <html> o <body>) mientras el mini-mapa está abierto,
  // para repintar las teselas sin tener que recargar la página.
  private themeObserver: MutationObserver | null = null;

  ngOnInit() {
    this.authService.currentUser$.subscribe((user) => {
      if (!user) {
        this.error = true;
        return;
      }

      this.alertsService.getByUser(user.id).subscribe({
        next: (data) => {
          this.alerts = data;
          this.computeStats(data);
          this.applyFilters();
        },
        error: () => {
          this.error = true;
        },
      });
    });
  }

  private computeStats(alerts: Alert[]) {
    this.totalAlertCount = alerts.length;
    this.attendedAlerts = alerts.filter(a => a.estado === 'Atendida').length;
    this.cancelledAlerts = alerts.filter(a => a.estado === 'Cancelada').length;

    // 👇 asume que 'tiempo' es parseable como fecha (ej. "2026-06-13T10:32:00").
    // Si tu formato es distinto (ej. "13 jun 2026, 10:32 AM"), dime el formato exacto
    // y ajusto el parseo.
    const today = new Date();
    this.alertsThisMonth = alerts.filter(a => {
      const alertDate = new Date(a.time);
      if (isNaN(alertDate.getTime())) return false;
      return alertDate.getMonth() === today.getMonth() &&
             alertDate.getFullYear() === today.getFullYear();
    }).length;
  }

  /** Click en una fila: expande/colapsa el detalle justo debajo, sin modal. */
  toggleExpand(alert: Alert) {
    if (this.expandedAlertId === alert.id) {
      this.destroyMap();
      this.expandedAlertId = null;
      return;
    }

    this.destroyMap(); // por si había otra fila abierta con su mini-mapa
    this.expandedAlertId = alert.id;

    const elId = `mini-map-${alert.id}`;
    setTimeout(() => {
      const el = document.getElementById(elId);
      if (el) this.initMap(alert.lat, alert.lng, elId);
    }, 50);
  }

  toggleMenu(id: number, event: Event) {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === id ? null : id;
  }

  @HostListener('document:click')
closeMenu() {
  this.openMenuId = null;
}

  mapsUrl(alert: Alert): string {
    return `https://www.google.com/maps?q=${alert.lat},${alert.lng}`;
  }

  /**
   * Detecta si el tema activo de la app es oscuro.
   *
   * 👇 Ajusta esto según cómo tu ThemeService marca el modo oscuro. Por defecto
   * revisa si <html> o <body> tienen la clase "dark". Si en tu app en vez de
   * eso usas, por ejemplo, un atributo `data-theme="dark"` en <html>, cambia
   * la condición de abajo por:
   *   document.documentElement.getAttribute('data-theme') === 'dark'
   */
  private isDarkMode(): boolean {
    return document.documentElement.classList.contains('dark') ||
           document.body.classList.contains('dark');
  }

  /** Agrega (o reemplaza) la capa de teselas según el tema actual. */
  private addLayerForTheme() {
    if (!this.map) return;

    if (this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
    }

    this.tileLayer = L.tileLayer(TILES, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
      className: this.isDarkMode() ? 'tiles-oscuras' : '',
    }).addTo(this.map);
  }

  private initMap(lat: number, lng: number, elementId: string) {
    this.destroyMap();
    this.currentMapElId = elementId;

    this.map = L.map(elementId, {
      center: [lat, lng],
      zoom: 16,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    this.addLayerForTheme();

    L.marker([lat, lng], { icon: iconDefault })
      .addTo(this.map)
      .bindPopup(this.alerts.find((a) => a.lat === lat && a.lng === lng)?.location || 'Ubicación de la alerta')
      .openPopup();

    // Si el usuario cambia de tema con el mini-mapa abierto, repintamos las teselas.
    this.themeObserver = new MutationObserver(() => this.addLayerForTheme());
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    this.themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
  }

  private destroyMap() {
    if (this.themeObserver) {
      this.themeObserver.disconnect();
      this.themeObserver = null;
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.tileLayer = null;
    this.currentMapElId = null;
  }

  toggleFullscreen() {
    if (!this.currentMapElId) return;
    const el = document.getElementById(this.currentMapElId);
    if (!el) return;

    if (!document.fullscreenElement) {
      el.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setTimeout(() => this.map?.invalidateSize(), 300);
  }

  /** La usuaria eligió (o quitó) un día en el calendario. */
  onDate(value: string | null) {
    this.dateFilter = value || null;
    this.applyFilters();
  }

  /** Quita el filtro de fecha y vuelve a mostrar todo el historial. */
  clearDateFilter() {
    this.dateFilter = null;
    this.applyFilters();
  }

  onTypeChange(event: Event) {
    this.typeFilter = (event.target as HTMLSelectElement).value;
    this.applyFilters();
  }

  onSearchChange(event: Event) {
    this.searchTerm = (event.target as HTMLInputElement).value;
    this.applyFilters();
  }

  /** Aplica fecha + medio de activación + búsqueda de texto sobre this.alertas y reinicia la paginación. */
  private applyFilters() {
    let result = this.alerts;

    if (this.dateFilter) {
      result = result.filter(a => {
        const fecha = new Date(a.time);
        if (isNaN(fecha.getTime())) return false;
        return this.toLocalIsoDate(fecha) === this.dateFilter;
      });
    }

    if (this.typeFilter && this.typeFilter !== 'Todas') {
      result = result.filter(a => a.activationMethod === this.typeFilter);
    }

    if (this.searchTerm.trim()) {
      const q = this.searchTerm.trim().toLowerCase();
      result = result.filter(a =>
        a.estado.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q) ||
        (a.activationMethod ?? '').toLowerCase().includes(q) ||
        a.time.toLowerCase().includes(q)
      );
    }

    this.filteredAlerts = result;
    this.currentPage = 1;
    this.resolveAddresses();
  }

  /** Convierte una fecha a 'YYYY-MM-DD' usando la hora local (evita el corrimiento de un día que da toISOString con UTC). */
  private toLocalIsoDate(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Muestra la fecha elegida en formato legible, ej. "13 jun 2026". */
  formatDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    const fecha = new Date(year, month - 1, day);
    return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /** Divide alerta.tiempo en fecha y hora legibles para las dos líneas de la tabla. */
  formatDateTime(time: string): { fecha: string; time: string } {
    const fecha = new Date(time);
    if (isNaN(fecha.getTime())) return { fecha: time, time: '' };
    return {
      fecha: fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  // --- Paginación ---
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredAlerts.length / this.pageSize));
  }

  get alertsPage(): Alert[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredAlerts.slice(start, start + this.pageSize);
  }

  get rangeStart(): number {
    return this.filteredAlerts.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredAlerts.length);
  }

  get visiblePages(): (number | null)[] {
    return compactPages(this.currentPage, this.totalPages);
  }

  goToPage(p: number) {
    this.currentPage = p;
    this.resolveAddresses();
  }

  previousPage() {
    if (this.currentPage > 1) this.currentPage--;
    this.resolveAddresses();
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
    this.resolveAddresses();
  }

  /**
   * Cambia las coordenadas por barrio y dirección (OpenStreetMap, como en la app). Solo las de la
   * página visible: el servicio consulta de a una por segundo y guarda lo ya resuelto.
   */
  private resolveAddresses() {
    for (const alert of this.alertsPage) {
      if (!alert.lat && !alert.lng) continue;
      if (alert.resolvedAddress) continue;
      this.geocoding.get(alert.lat, alert.lng).then((place) => {
        if (!place) return;
        const text = [place.neighborhood, place.address].filter(Boolean).join(' · ') || place.city;
        if (!text) return;
        alert.location = text;
        alert.resolvedAddress = true;
        if (this.expandedAlertId === alert.id) this.map?.eachLayer((layer) => {
          if (layer instanceof L.Marker) layer.setPopupContent(text);
        });
        this.cdr.markForCheck();
      });
    }
  }

  /**
   * Lleva al módulo de Evidencias, pasando el id de la alerta por query param
   * para que esa pantalla pueda filtrar y mostrar solo las evidencias de esta alerta.
   */
  viewEvidences(alert: Alert) {
    this.router.navigate(['/dashboard/evidence'], {
      queryParams: { alertaId: alert.id },
    });
  }

  /**
   * TODO: reemplazar por la llamada real a tu backend (alertsService.marcarCancelada(alerta.id)).
   * Por ahora actualiza el estado localmente para que la UI responda de inmediato.
   */
  markCancelled(alert: Alert) {
    alert.estado = 'Cancelada';
    this.computeStats(this.alerts);
  }

  ngOnDestroy() {
    this.destroyMap();
  }
}