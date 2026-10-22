import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, NgClass } from '@angular/common';
import * as L from 'leaflet';
import { AlertsService } from '../../../core/services/alerts.services';
import { Alert } from '../../../core/models/alert.model';
import { AuthService } from '../../../core/auth/auth.service';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { DatePicker } from '../../../shared/components/date-picker/date-picker';
import { compactPages } from '../../../shared/utils/pagination';

const iconDefault = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// OpenStreetMap tiles (CARTO ones now require a key and showed "API KEY REQUIRED").
// In dark mode they are darkened with a CSS filter (tiles-oscuras class on the layer).
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

  // Date chosen in the picker ('YYYY-MM-DD' format of <input type="date">), or null without a filter.
  dateFilter: string | null = null;

  // Filter by activation method ('Todas' = no filter).
  typeFilter = 'Todas';
  searchTerm = '';

  // NOTE: these 4 values must exactly match the ones the backend sends
  // in Alert.activationMethod. Adjust the list if your real names are different.
  availableMethods = ['Botón de pánico', 'Contacto', 'Widget', 'Movimiento sospechoso', 'Botón de encendido', 'Manual'];


  totalAlertCount = 0;
  alertsThisMonth = 0;
  attendedAlerts = 0;
  cancelledAlerts = 0;

  methodBadge: Record<string, string> = {
    'Botón de pánico': 'badge-button',
    'Contacto': 'badge-manual',
    'Widget': 'badge-widget',
    'Movimiento sospechoso': 'badge-movement',
    'Botón de encendido': 'badge-movement',
    'Manual': 'badge-manual',
  };

  statusBadge: Record<string, string> = {
    'Atendida': 'badge-ok',
    'Pendiente': 'badge-pending',
    'Cancelada': 'badge-false',
  };

  // Row expanded inline (replaces the modal). Only one at a time.
  expandedAlertId: number | null = null;
  openMenuId: number | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 7;

  private map: L.Map | null = null;
  private tileLayer: L.TileLayer | null = null;
  private currentMapElId: string | null = null;
  // Watches theme changes (class/attribute on <html> or <body>) while the mini map is open,
  // to repaint the tiles without reloading the page.
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
    this.attendedAlerts = alerts.filter(a => a.status === 'Atendida').length;
    this.cancelledAlerts = alerts.filter(a => a.status === 'Cancelada').length;

    // 👇 assumes 'time' can be parsed as a date (e.g. "2026-06-13T10:32:00").
    // If your format is different (e.g. "13 jun 2026, 10:32 AM"), tell me the exact format
    // y ajusto el parseo.
    const today = new Date();
    this.alertsThisMonth = alerts.filter(a => {
      const alertDate = new Date(a.time);
      if (isNaN(alertDate.getTime())) return false;
      return alertDate.getMonth() === today.getMonth() &&
             alertDate.getFullYear() === today.getFullYear();
    }).length;
  }

  /** Click on a row: expands/collapses the detail right below, without a modal. */
  toggleExpand(alert: Alert) {
    if (this.expandedAlertId === alert.id) {
      this.destroyMap();
      this.expandedAlertId = null;
      return;
    }

    this.destroyMap(); // in case another row was open with its mini map
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
   * Detects whether the active app theme is dark.
   *
   * 👇 Adjust this to how your ThemeService marks dark mode. By default
   * it checks whether <html> or <body> have the "dark" class. If your app uses,
   * for example, a `data-theme="dark"` attribute on <html> instead, change
   * the condition below to:
   *   document.documentElement.getAttribute('data-theme') === 'dark'
   */
  private isDarkMode(): boolean {
    return document.documentElement.classList.contains('dark') ||
           document.body.classList.contains('dark');
  }

  /** Adds (or replaces) the tile layer according to the current theme. */
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

    // If the user changes the theme with the mini map open, we repaint the tiles.
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

  /** The user chose (or removed) a day in the calendar. */
  onDate(value: string | null) {
    this.dateFilter = value || null;
    this.applyFilters();
  }

  /** Removes the date filter and shows the whole history again. */
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

  /** Applies date + activation method + text search over this.alerts and resets the pagination. */
  private applyFilters() {
    let result = this.alerts;

    if (this.dateFilter) {
      result = result.filter(a => {
        const date = new Date(a.time);
        if (isNaN(date.getTime())) return false;
        return this.toLocalIsoDate(date) === this.dateFilter;
      });
    }

    if (this.typeFilter && this.typeFilter !== 'Todas') {
      result = result.filter(a => a.activationMethod === this.typeFilter);
    }

    if (this.searchTerm.trim()) {
      const q = this.searchTerm.trim().toLowerCase();
      result = result.filter(a =>
        a.status.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q) ||
        (a.activationMethod ?? '').toLowerCase().includes(q) ||
        a.time.toLowerCase().includes(q)
      );
    }

    this.filteredAlerts = result;
    this.currentPage = 1;
    this.resolveAddresses();
  }

  /** Converts a date to 'YYYY-MM-DD' using local time (avoids the one-day shift toISOString gives with UTC). */
  private toLocalIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Shows the chosen date in a readable format, e.g. "13 jun 2026". */
  formatDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /** Splits alert.time into a readable date and time for the two lines of the table. */
  formatDateTime(time: string): { date: string; time: string } {
    const date = new Date(time);
    if (isNaN(date.getTime())) return { date: time, time: '' };
    return {
      date: date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  // --- Pagination ---
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
   * Replaces the coordinates with neighborhood and address (OpenStreetMap, as in the app). Only those of the
   * visible page: the service queries one per second and keeps what is already resolved.
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
   * Goes to the Evidence module, passing the alert id as a query param
   * so that screen can filter and show only the evidence of this alert.
   */
  viewEvidences(alert: Alert) {
    this.router.navigate(['/dashboard/evidence'], {
      queryParams: { alertaId: alert.id },
    });
  }

  /**
   * TODO: replace with the real call to your backend (alertsService.markCancelled(alert.id)).
   * For now it updates the status locally so the UI responds right away.
   */
  markCancelled(alert: Alert) {
    alert.status = 'Cancelada';
    this.computeStats(this.alerts);
  }

  ngOnDestroy() {
    this.destroyMap();
  }
}