import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, NgClass } from '@angular/common';
import * as L from 'leaflet';
import { AlertsService } from '../../../core/services/alerts.services';
import { Alerta } from '../../../core/models/alert.model';
import { AuthService } from '../../../core/auth/auth.service';

const iconDefault = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Tiles de CARTO: mismo mapa base, una versión clara y una oscura.
const TILES_CLARO = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILES_OSCURO = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ATRIBUCION_TILES = '© OpenStreetMap contributors © CARTO';

@Component({
  selector: 'app-alert-history',
  imports: [CommonModule, NgClass],
  templateUrl: './alert-history.html',
  styleUrl: './alert-history.scss',
})
export class AlertHistory implements OnInit, OnDestroy {

  private alertsService = inject(AlertsService);
  private authService = inject(AuthService);
  private router = inject(Router);

  alertas: Alerta[] = [];
  alertasFiltradas: Alerta[] = [];
  error = false;

  // Fecha elegida en el selector (formato 'YYYY-MM-DD' del <input type="date">), o null si no hay filtro.
  fechaFiltro: string | null = null;

  // Filtro por medio de activación ('Todas' = sin filtro).
  tipoFiltro = 'Todas';
  searchTerm = '';

  // NOTA: estos 4 valores deben coincidir exactamente con los que envía el backend
  // en Alerta.medioActivacion. Ajusta la lista si tus nombres reales son distintos.
  mediosDisponibles = ['Botón de pánico', 'Widget', 'Movimiento sospechoso', 'Manual'];

  @ViewChild('fechaInput') private fechaInputRef?: ElementRef<HTMLInputElement>;

  totalAlertas = 0;
  alertasEsteMes = 0;
  alertasAtendidas = 0;
  alertasCanceladas = 0;

  medioBadge: Record<string, string> = {
    'Botón de pánico': 'badge-boton',
    'Widget': 'badge-widget',
    'Movimiento sospechoso': 'badge-movimiento',
    'Manual': 'badge-manual',
  };

  estadoBadge: Record<string, string> = {
    'Atendida': 'badge-ok',
    'Pendiente': 'badge-pendiente',
    'Cancelada': 'badge-falsa',
  };

  // Fila expandida in-line (reemplaza al modal). Solo una a la vez.
  expandedAlertaId: number | null = null;
  menuAbiertoId: number | null = null;

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
    this.authService.currentUser$.subscribe((usuario) => {
      if (!usuario) {
        this.error = true;
        return;
      }

      this.alertsService.getByUsuario(usuario.id).subscribe({
        next: (data) => {
          this.alertas = data;
          this.calcularStats(data);
          this.aplicarFiltros();
        },
        error: () => {
          this.error = true;
        },
      });
    });
  }

  private calcularStats(alertas: Alerta[]) {
    this.totalAlertas = alertas.length;
    this.alertasAtendidas = alertas.filter(a => a.estado === 'Atendida').length;
    this.alertasCanceladas = alertas.filter(a => a.estado === 'Cancelada').length;

    // 👇 asume que 'tiempo' es parseable como fecha (ej. "2026-06-13T10:32:00").
    // Si tu formato es distinto (ej. "13 jun 2026, 10:32 AM"), dime el formato exacto
    // y ajusto el parseo.
    const hoy = new Date();
    this.alertasEsteMes = alertas.filter(a => {
      const fechaAlerta = new Date(a.tiempo);
      if (isNaN(fechaAlerta.getTime())) return false;
      return fechaAlerta.getMonth() === hoy.getMonth() &&
             fechaAlerta.getFullYear() === hoy.getFullYear();
    }).length;
  }

  /** Click en una fila: expande/colapsa el detalle justo debajo, sin modal. */
  toggleExpand(alerta: Alerta) {
    if (this.expandedAlertaId === alerta.id) {
      this.destruirMapa();
      this.expandedAlertaId = null;
      return;
    }

    this.destruirMapa(); // por si había otra fila abierta con su mini-mapa
    this.expandedAlertaId = alerta.id;

    const elId = `mini-map-${alerta.id}`;
    setTimeout(() => {
      const el = document.getElementById(elId);
      if (el) this.inicializarMapa(alerta.lat, alerta.lng, elId);
    }, 50);
  }

  toggleMenu(id: number, event: Event) {
    event.stopPropagation();
    this.menuAbiertoId = this.menuAbiertoId === id ? null : id;
  }

  @HostListener('document:click')
cerrarMenu() {
  this.menuAbiertoId = null;
}

  mapsUrl(alerta: Alerta): string {
    return `https://www.google.com/maps?q=${alerta.lat},${alerta.lng}`;
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
  private esModoOscuro(): boolean {
    return document.documentElement.classList.contains('dark') ||
           document.body.classList.contains('dark');
  }

  /** Agrega (o reemplaza) la capa de teselas según el tema actual. */
  private agregarCapaSegunTema() {
    if (!this.map) return;

    if (this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
    }

    const url = this.esModoOscuro() ? TILES_OSCURO : TILES_CLARO;
    this.tileLayer = L.tileLayer(url, {
      attribution: ATRIBUCION_TILES,
      maxZoom: 19,
    }).addTo(this.map);
  }

  private inicializarMapa(lat: number, lng: number, elementId: string) {
    this.destruirMapa();
    this.currentMapElId = elementId;

    this.map = L.map(elementId, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: false,
      scrollWheelZoom: false,
    });

    this.agregarCapaSegunTema();

    L.marker([lat, lng], { icon: iconDefault })
      .addTo(this.map)
      .bindPopup('Ubicación de la alerta')
      .openPopup();

    // Si el usuario cambia de tema con el mini-mapa abierto, repintamos las teselas.
    this.themeObserver = new MutationObserver(() => this.agregarCapaSegunTema());
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    this.themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
  }

  private destruirMapa() {
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

  /** Abre el date picker nativo al hacer clic en cualquier parte de la pastilla, no solo en el input invisible. */
  abrirCalendario() {
    const input = this.fechaInputRef?.nativeElement;
    if (!input) return;

    input.focus();

    // showPicker() es lo ideal (Chrome/Edge/Opera); usamos "any" porque no todas las
    // versiones de TypeScript/lib.dom lo tienen tipado, y así evitamos un error de compilación.
    const conShowPicker = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof conShowPicker.showPicker === 'function') {
      try {
        conShowPicker.showPicker();
        return;
      } catch {
        // Algunos navegadores lanzan error si no se llama justo desde el gesto del usuario;
        // en ese caso caemos al respaldo de abajo.
      }
    }
    input.click();
  }

  /** Se dispara cuando la usuaria elige un día en el input de fecha. */
  onFechaChange(event: Event) {
    const valor = (event.target as HTMLInputElement).value;
    this.fechaFiltro = valor || null;
    this.aplicarFiltros();
  }

  /** Quita el filtro de fecha y vuelve a mostrar todo el historial. */
  limpiarFiltroFecha() {
    this.fechaFiltro = null;
    this.aplicarFiltros();
  }

  onTipoChange(event: Event) {
    this.tipoFiltro = (event.target as HTMLSelectElement).value;
    this.aplicarFiltros();
  }

  onBuscarChange(event: Event) {
    this.searchTerm = (event.target as HTMLInputElement).value;
    this.aplicarFiltros();
  }

  /** Aplica fecha + medio de activación + búsqueda de texto sobre this.alertas y reinicia la paginación. */
  private aplicarFiltros() {
    let resultado = this.alertas;

    if (this.fechaFiltro) {
      resultado = resultado.filter(a => {
        const fecha = new Date(a.tiempo);
        if (isNaN(fecha.getTime())) return false;
        return this.aFechaLocalISO(fecha) === this.fechaFiltro;
      });
    }

    if (this.tipoFiltro && this.tipoFiltro !== 'Todas') {
      resultado = resultado.filter(a => a.medioActivacion === this.tipoFiltro);
    }

    if (this.searchTerm.trim()) {
      const q = this.searchTerm.trim().toLowerCase();
      resultado = resultado.filter(a =>
        a.estado.toLowerCase().includes(q) ||
        a.ubicacion.toLowerCase().includes(q) ||
        (a.medioActivacion ?? '').toLowerCase().includes(q) ||
        a.tiempo.toLowerCase().includes(q)
      );
    }

    this.alertasFiltradas = resultado;
    this.currentPage = 1;
  }

  /** Convierte una fecha a 'YYYY-MM-DD' usando la hora local (evita el corrimiento de un día que da toISOString con UTC). */
  private aFechaLocalISO(fecha: Date): string {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  /** Muestra la fecha elegida en formato legible, ej. "13 jun 2026". */
  formatearFecha(fechaISO: string): string {
    const [anio, mes, dia] = fechaISO.split('-').map(Number);
    const fecha = new Date(anio, mes - 1, dia);
    return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /** Divide alerta.tiempo en fecha y hora legibles para las dos líneas de la tabla. */
  formatearFechaHora(tiempo: string): { fecha: string; hora: string } {
    const fecha = new Date(tiempo);
    if (isNaN(fecha.getTime())) return { fecha: tiempo, hora: '' };
    return {
      fecha: fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }),
      hora: fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  // --- Paginación ---
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.alertasFiltradas.length / this.pageSize));
  }

  get alertasPagina(): Alerta[] {
    const inicio = (this.currentPage - 1) * this.pageSize;
    return this.alertasFiltradas.slice(inicio, inicio + this.pageSize);
  }

  get rangoInicio(): number {
    return this.alertasFiltradas.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get rangoFin(): number {
    return Math.min(this.currentPage * this.pageSize, this.alertasFiltradas.length);
  }

  get paginasVisibles(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  irAPagina(p: number) {
    this.currentPage = p;
  }

  paginaAnterior() {
    if (this.currentPage > 1) this.currentPage--;
  }

  paginaSiguiente() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  /**
   * Lleva al módulo de Evidencias, pasando el id de la alerta por query param
   * para que esa pantalla pueda filtrar y mostrar solo las evidencias de esta alerta.
   */
  verEvidencias(alerta: Alerta) {
    this.router.navigate(['/dashboard/evidence'], {
      queryParams: { alertaId: alerta.id },
    });
  }

  /**
   * TODO: reemplazar por la llamada real a tu backend (alertsService.marcarCancelada(alerta.id)).
   * Por ahora actualiza el estado localmente para que la UI responda de inmediato.
   */
  marcarCancelada(alerta: Alerta) {
    alerta.estado = 'Cancelada';
    this.calcularStats(this.alertas);
  }

  ngOnDestroy() {
    this.destruirMapa();
  }
}