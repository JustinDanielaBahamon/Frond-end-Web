import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
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

  @ViewChild('fechaInput') private fechaInputRef?: ElementRef<HTMLInputElement>;

  totalAlertas = 0;
  alertasEsteMes = 0;
  alertasPendientes = 0;
  alertasAtendidas = 0;
  alertasFalsas = 0;

  tipoBadge: Record<string, string> = {
    'SOS': 'badge-sos',
    'Medical': 'badge-medical',
    'Robo': 'badge-robo',
    'Acoso': 'badge-acoso',
  };

  estadoBadge: Record<string, string> = {
    'Atendida': 'badge-ok',
    'Pendiente': 'badge-pendiente',
    'Falsa alarma': 'badge-falsa',
  };

  // Fila expandida in-line (reemplaza al modal). Solo una a la vez.
  expandedAlertaId: number | null = null;

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
          this.aplicarFiltroFecha();
        },
        error: () => {
          this.error = true;
        },
      });
    });
  }

  private calcularStats(alertas: Alerta[]) {
    this.totalAlertas = alertas.length;
    this.alertasPendientes = alertas.filter(a => a.estado === 'Pendiente').length;
    this.alertasAtendidas = alertas.filter(a => a.estado === 'Atendida').length;
    this.alertasFalsas = alertas.filter(a => a.estado === 'Falsa alarma').length;

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
    this.aplicarFiltroFecha();
  }

  /** Quita el filtro y vuelve a mostrar todo el historial. */
  limpiarFiltroFecha() {
    this.fechaFiltro = null;
    this.aplicarFiltroFecha();
  }

  /** Filtra this.alertas por el día elegido (comparando solo año-mes-día). */
  private aplicarFiltroFecha() {
    if (!this.fechaFiltro) {
      this.alertasFiltradas = this.alertas;
      return;
    }

    this.alertasFiltradas = this.alertas.filter(a => {
      const fecha = new Date(a.tiempo);
      if (isNaN(fecha.getTime())) return false;
      return this.aFechaLocalISO(fecha) === this.fechaFiltro;
    });
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
   * TODO: reemplazar por la llamada real a tu backend (alertsService.marcarFalsaAlarma(alerta.id)).
   * Por ahora actualiza el estado localmente para que la UI responda de inmediato.
   */
  marcarFalsaAlarma(alerta: Alerta) {
    alerta.estado = 'Falsa alarma';
    this.calcularStats(this.alertas);
  }

  ngOnDestroy() {
    this.destruirMapa();
  }
}