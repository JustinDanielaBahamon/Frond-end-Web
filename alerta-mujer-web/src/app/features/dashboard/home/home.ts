import { AfterViewInit, Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import { NearbyZoneService } from '../../../core/services/nearby-zone.service';
import { NearbyZone } from '../../../core/models/nearby-zone.model';
import { UserSecurityStatusService } from '../../../core/services/user-security-status.service';
import { EstadoSeguridad } from '../../../core/models/security-status.model';
import { AuthService } from '../../../core/auth/auth.service';
import { DeviceService, UserDevice } from '../../../core/services/device.service';
import { PhoneLocationService } from '../../../core/services/phone.location.services';
import { AlertsService } from '../../../core/services/alerts.services';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { Alerta } from '../../../core/models/alert.model';
import { UbicacionEntry } from '../../../core/models/location.model';

interface SeguridadItem {
  icon: string;
  valor: string;
  descripcion: string;
  configurado: boolean;
  tooltip?: string;
}

interface UltimaUbicacion {
  lat: number;
  lng: number;
  direccion: string;
  fecha: string;
  coordenadas: string;
  precision: string;
}

interface UltimaEmergencia {
  id: number;
  fecha: string;
  hora: string;
  ubicacion: string;
  activadaMediante: string;
  contactosNotificados: number | null;
  estado: string;
}

interface AccesoRapido {
  icon: string;
  label: string;
  sub: string;
  route: string;
}

// Mientras no haya ubicación del celular, el mapa muestra Neiva
const CENTRO_POR_DEFECTO: L.LatLngTuple = [2.9273, -75.2819];

const fechaLarga = (d: Date) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
const horaCorta = (d: Date) => d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgClass, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit, AfterViewInit, OnDestroy {

  private map: L.Map | null = null;
  private zoneService = inject(NearbyZoneService);
  private securityStatusService = inject(UserSecurityStatusService);
  private authService = inject(AuthService);
  private deviceService = inject(DeviceService);
  private phoneLocation = inject(PhoneLocationService);
  private alertsService = inject(AlertsService);
  private geocoding = inject(GeocodingService);
  private destroyRef = inject(DestroyRef);
  private zonas: NearbyZone[] = [];
  private userMarker: L.Marker | null = null;
  private zoneCircles: L.Circle[] = [];
  private zoneMarkers: L.Marker[] = [];

  // ── ESTADO DE SEGURIDAD ───────────────────────────
  isLoadingStatus = signal(true);
  estadoSeguridad = signal<SeguridadItem[]>([]);
  estadoGeneral = signal<{ nivel: string; color: string; porcentaje: number } | null>(null);

  // ── MI DISPOSITIVO (celular más reciente) ─────────
  miCelular = signal<UserDevice | null>(null);
  celularesCargados = signal(false);

  // ── ÚLTIMA UBICACIÓN (enviada por el celular) ─────
  ultimaUbicacion = signal<UltimaUbicacion | null>(null);
  isRefreshing = signal(false);
  avisoUbicacion = signal<string | null>(null);

  // ── ALERTAS ───────────────────────────────────────
  ultimaEmergencia = signal<UltimaEmergencia | null>(null);
  alertasCargadas = signal(false);

  accesosRapidos: AccesoRapido[] = [
    { icon: 'ti-alert-triangle', label: 'Mis emergencias', sub: 'Ver historial',    route: '/dashboard/alert-history' },
    { icon: 'ti-folder',         label: 'Evidencias',      sub: 'Ver mis archivos', route: '/dashboard/evidence' },
    { icon: 'ti-users',          label: 'Contactos',       sub: 'Gestionar',        route: '/dashboard/emergency-contacts' },
    { icon: 'ti-map-pin',        label: 'Ubicación',       sub: 'Ver mapa',         route: '/dashboard/ubicacion' },
    { icon: 'ti-lifebuoy',       label: 'Asistencia',      sub: 'Recursos y ayuda', route: '/dashboard/assistance' },
  ];

  ngOnInit(): void {
    this.cargarEstadoSeguridad();
    this.cargarCelular();
    this.cargarUltimaEmergencia();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.inicializarMiniMapa();
      this.cargarUltimaUbicacion();
      this.cargarZonasPeligrosas();
    }, 100);
  }

  /** Estado de seguridad calculado con los datos reales de la cuenta y del celular */
  private cargarEstadoSeguridad(): void {
    this.isLoadingStatus.set(true);
    this.securityStatusService.getSecurityStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (estado: EstadoSeguridad) => {
          this.estadoSeguridad.set(estado.requisitos.map(req => ({
            icon: req.icon,
            valor: req.valor,
            descripcion: req.label,
            configurado: req.cumplido,
            tooltip: req.cumplido ? `${req.label}: ${req.valor}` : `${req.label}: ${req.valor} (requiere atención)`,
          })));
          const nivelTextos = {
            seguro: 'Tu cuenta está protegida',
            advertencia: 'Requiere atención',
            critico: 'Configuración incompleta',
          };
          this.estadoGeneral.set({ nivel: nivelTextos[estado.nivel], color: estado.color, porcentaje: estado.porcentaje });
          this.isLoadingStatus.set(false);
        },
        error: () => {
          this.estadoSeguridad.set([]);
          this.estadoGeneral.set({ nivel: 'No se pudo consultar', color: 'rojo', porcentaje: 0 });
          this.isLoadingStatus.set(false);
        },
      });
  }

  private cargarCelular(): void {
    this.deviceService.getMyDevices()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (celulares) => {
          const masReciente = [...celulares].sort((a, b) =>
            (b.lastAccess ?? '').localeCompare(a.lastAccess ?? ''))[0] ?? null;
          this.miCelular.set(masReciente);
          this.celularesCargados.set(true);
        },
        error: () => this.celularesCargados.set(true),
      });
  }

  nombreCelular(d: UserDevice): string {
    return [d.brand, d.model].filter(Boolean).join(' ') || 'Celular';
  }

  ultimaConexion(d: UserDevice): string {
    if (!d.lastAccess) return 'Sin registro';
    const f = new Date(d.lastAccess);
    return `${f.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}, ${horaCorta(f)}`;
  }

  private cargarUltimaEmergencia(): void {
    this.alertsService.getMine()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (alertas) => {
          this.alertasCargadas.set(true);
          const a = alertas[0];
          if (!a) return;
          this.ultimaEmergencia.set(this.aEmergencia(a));
          this.alertsService.contarContactosAvisados(a.id).subscribe({
            next: (n) => this.ultimaEmergencia.update(e => e && { ...e, contactosNotificados: n }),
            error: () => {},
          });
        },
        error: () => this.alertasCargadas.set(true),
      });
  }

  private aEmergencia(a: Alerta): UltimaEmergencia {
    const inicio = new Date(a.started_at ?? a.created_at ?? Date.now());
    return {
      id: a.id,
      fecha: fechaLarga(inicio),
      hora: horaCorta(inicio),
      ubicacion: a.ubicacion || 'Sin ubicación',
      activadaMediante: a.medioActivacion,
      contactosNotificados: null,
      estado: a.estado,
    };
  }

  // ── Ubicación del celular ─────────────────────────

  private cargarUltimaUbicacion(): void {
    this.phoneLocation.getLatest()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (loc) => this.mostrarUbicacion(loc), error: () => {} });
  }

  private mostrarUbicacion(loc: UbicacionEntry | null): void {
    if (!loc) return;
    const fecha = loc.recordedAt ? new Date(loc.recordedAt) : null;
    this.ultimaUbicacion.set({
      lat: loc.lat,
      lng: loc.lng,
      direccion: 'Buscando dirección…',
      fecha: fecha ? `${fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}, ${horaCorta(fecha)}` : loc.time,
      coordenadas: `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`,
      precision: loc.accuracy ? `±${Math.round(loc.accuracy)} metros` : 'Sin dato',
    });
    this.geocoding.obtener(loc.lat, loc.lng).then((lugar) => {
      const texto = lugar ? [lugar.direccion, lugar.barrio, lugar.ciudad].filter(Boolean).join(', ') : '';
      this.ultimaUbicacion.update(u => u && { ...u, direccion: texto || 'Dirección no disponible' });
      this.actualizarMarcador();
    });
    this.actualizarMarcador();
    this.calcularDistancias();
  }

  /**
   * Pide al celular su ubicación actual (push silencioso) y espera hasta 20 s el punto nuevo.
   * Si no responde, se queda la última que envió.
   */
  refrescarUbicacion(): void {
    if (this.isRefreshing()) return;
    this.isRefreshing.set(true);
    this.avisoUbicacion.set(null);
    this.phoneLocation.pedirAlCelular().subscribe({
      next: (r) => this.esperarUbicacion(new Date(r.solicitadoEn).getTime() - 5000, Date.now() + 20000),
      error: (e) => {
        this.avisoUbicacion.set(e?.error?.message ?? 'No se pudo contactar al celular.');
        this.isRefreshing.set(false);
      },
    });
  }

  private esperarUbicacion(desde: number, limite: number): void {
    this.phoneLocation.getLatest().subscribe({
      next: (loc) => {
        const nueva = !!loc?.recordedAt && new Date(loc.recordedAt).getTime() >= desde;
        if (nueva || Date.now() >= limite) {
          if (!nueva) this.avisoUbicacion.set('El celular no respondió. Se muestra la última ubicación que envió.');
          this.mostrarUbicacion(loc);
          this.isRefreshing.set(false);
          return;
        }
        setTimeout(() => this.esperarUbicacion(desde, limite), 2500);
      },
      error: () => this.isRefreshing.set(false),
    });
  }

  // ── Mapa ──────────────────────────────────────────

  private inicializarMiniMapa(): void {
    this.map = L.map('home-mini-map', {
      center: CENTRO_POR_DEFECTO,
      zoom: 13,
      zoomControl: true,
      // La rueda del mouse desplaza la página; el mapa se acerca con los botones + y -
      scrollWheelZoom: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);
  }

  private actualizarMarcador(): void {
    const u = this.ultimaUbicacion();
    if (!this.map || !u) return;
    const popup = `
      <div style="text-align: center; min-width: 200px;">
        <strong style="color: #6d28d9; font-size: 14px;">📍 Mi celular</strong><br>
        <span style="font-size: 12px; color: #666;">${u.direccion}</span><br>
        <small style="color: #999;">${u.fecha}</small>
      </div>`;
    if (this.userMarker) {
      this.userMarker.setLatLng([u.lat, u.lng]).setPopupContent(popup);
    } else {
      this.userMarker = L.marker([u.lat, u.lng], { icon: this.iconoCelular() }).addTo(this.map).bindPopup(popup);
    }
    this.map.setView([u.lat, u.lng], 16);
  }

  private iconoCelular(): L.DivIcon {
    return L.divIcon({
      className: '',
      html: `
        <svg width="36" height="50" viewBox="0 0 36 50" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3));">
          <defs>
            <linearGradient id="gradientPin" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#a855f7" />
              <stop offset="100%" style="stop-color:#6d28d9" />
            </linearGradient>
          </defs>
          <path d="M18 0 C8 0 0 8 0 18 C0 28 18 50 18 50 C18 50 36 28 36 18 C36 8 28 0 18 0 Z" fill="url(#gradientPin)" stroke="white" stroke-width="2"/>
          <circle cx="18" cy="18" r="8" fill="white"/>
          <circle cx="18" cy="18" r="4" fill="#6d28d9"/>
        </svg>`,
      iconSize: [36, 50],
      iconAnchor: [18, 50],
      popupAnchor: [0, -50],
    });
  }

  /** Cargar y mostrar las zonas del backend (sin datos inventados: si no hay, el mapa queda sin zonas) */
  private cargarZonasPeligrosas(): void {
    if (!this.map) return;

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;

    this.zoneService.getByUser(currentUser.id).subscribe({
      next: (zonas) => {
        this.zonas = zonas;
        this.dibujarZonasEnMapa();
      },
      error: (err) => {
        console.error('Error al cargar zonas:', err);
        this.zonas = [];
        this.dibujarZonasEnMapa();
      }
    });
  }

  /** Dibujar zonas en el mapa con colores según el tipo */
  private dibujarZonasEnMapa(): void {
    if (!this.map) return;

    // Limpiar zonas anteriores
    this.zoneCircles.forEach(circle => circle.remove());
    this.zoneCircles = [];
    this.zoneMarkers.forEach(marker => marker.remove());
    this.zoneMarkers = [];

    this.zonas.forEach(zona => {
      if (!this.map) return;

      const config = this.obtenerConfigZona(zona.type);
      
      // Si tiene radio, dibujar círculo
      if (zona.radiusMeters) {
        const circle = L.circle([zona.lat, zona.lng], {
          radius: zona.radiusMeters,
          color: config.borderColor,
          fillColor: config.fillColor,
          fillOpacity: 0.25,
          weight: 2,
        }).addTo(this.map);

        circle.bindPopup(`
          <div style="min-width: 180px;">
            <strong style="color: ${config.borderColor};">${config.emoji} ${zona.name}</strong><br>
            <span style="font-size: 12px; color: #666;">${config.label}</span><br>
            ${zona.description ? `<p style="font-size: 11px; margin: 5px 0; color: #888;">${zona.description}</p>` : ''}
            ${zona.address ? `<small style="color: #999;">📍 ${zona.address}</small>` : ''}
          </div>
        `);

        this.zoneCircles.push(circle);
      }

      // Agregar marcador con icono personalizado
      const iconoZona = L.divIcon({
        className: '',
        html: `
          <div style="
            width: 36px;
            height: 36px;
            background: ${config.fillColor};
            border: 2px solid ${config.borderColor};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">
            ${config.emoji}
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([zona.lat, zona.lng], { icon: iconoZona })
        .addTo(this.map)
        .bindPopup(`
          <div style="min-width: 180px;">
            <strong style="color: ${config.borderColor};">${config.emoji} ${zona.name}</strong><br>
            <span style="font-size: 12px; color: #666;">${config.label}</span><br>
            ${zona.description ? `<p style="font-size: 11px; margin: 5px 0; color: #888;">${zona.description}</p>` : ''}
            ${zona.address ? `<small style="color: #999;">📍 ${zona.address}</small><br>` : ''}
            ${zona.distanceKm ? `<small style="color: #999;">📏 ${zona.distanceKm.toFixed(2)} km de distancia</small>` : ''}
          </div>
        `);

      this.zoneMarkers.push(marker);
    });

    // Calcular distancias desde la ubicación del usuario
    this.calcularDistancias();
  }

  /** Calcular distancias de zonas desde la última ubicación del celular */
  private calcularDistancias(): void {
    const u = this.ultimaUbicacion();
    if (!u) return;
    this.zonas = this.zonas.map(zona => ({
      ...zona,
      distanceKm: this.calcularDistanciaKm(u.lat, u.lng, zona.lat, zona.lng)
    })).sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
  }

  /** Calcular distancia entre dos puntos en km (fórmula de Haversine) */
  private calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /** Obtener configuración de color e icono según el tipo de zona */
  private obtenerConfigZona(type: NearbyZone['type']): { 
    fillColor: string; 
    borderColor: string; 
    label: string; 
    emoji: string;
  } {
    const configs = {
      risk: { 
        fillColor: '#cb1ce6', 
        borderColor: '#8f12a2', 
        label: 'Zona de riesgo', 
        emoji: '⚠️' 
      },
      safe: { 
        fillColor: '#5316a3', 
        borderColor: '#431580', 
        label: 'Zona segura', 
        emoji: '🛡️' 
      },
      help: { 
        fillColor: '#500ee9', 
        borderColor: '#3d02c7', 
        label: 'Punto de ayuda', 
        emoji: '🆘' 
      },
      policia: { 
        fillColor: '#9333ea', 
        borderColor: '#7e22ce', 
        label: 'Estación de policía', 
        emoji: '👮' 
      },
      asistencia: { 
        fillColor: '#733bf6', 
        borderColor: '#6025eb', 
        label: 'Centro de asistencia', 
        emoji: '🏥' 
      },
    };

    return configs[type] || configs.risk;
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
