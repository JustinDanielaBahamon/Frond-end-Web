import { Component, OnInit, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import { NearbyZoneService } from '../../../core/services/nearby-zone.service';
import { NearbyZone } from '../../../core/models/nearby-zone.model';
import { UserSecurityStatusService } from '../../../core/services/user-security-status.service';
import { EstadoSeguridad } from '../../../core/models/security-status.model';
import { AuthService } from '../../../core/auth/auth.service';

interface SeguridadItem {
  icon: string;
  valor: string;
  descripcion: string;
  configurado: boolean;
  tooltip?: string;
}

interface MiDispositivo {
  estado: string;
  ultimaComunicacion: string;
  ultimaUbicacion: string;
}

interface ActividadItem {
  icon: string;
  color: 'peligro' | 'exito' | 'principal';
  titulo: string;
  fecha: string;
}

interface UltimaEmergencia {
  fecha: string;
  hora: string;
  ubicacion: string;
  activadaMediante: string;
  contactosNotificados: number;
  estado: string;
}

interface UltimaUbicacion {
  lat: number;
  lng: number;
  direccion: string;
  fecha: string;
  coordenadas: string;
  precision: string;
}

interface AccesoRapido {
  icon: string;
  color: 'peligro' | 'exito' | 'principal' | 'acento' | 'advertencia';
  label: string;
  sub: string;
  route: string;
}

interface AccionRapida {
  icon: string;
  label: string;
  route: string;
  disabled?: boolean;
}

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
  private zonas: NearbyZone[] = [];
  private userMarker: L.Marker | null = null;
  private zoneCircles: L.Circle[] = [];
  private zoneMarkers: L.Marker[] = [];
  
  // Estado público para el template
  isRefreshing = false;
  isLoadingStatus = true;

  // ── ESTADO DE SEGURIDAD ───────────────────────────
  // Sincronizado con el backend: cada item refleja el estado real
  estadoSeguridad: SeguridadItem[] = [];
  estadoGeneral: { nivel: string; color: string; icono: string; porcentaje: number } | null = null;

  // ── MI DISPOSITIVO ────────────────────────────────
  miDispositivo: MiDispositivo = {
    estado: 'Conectado',
    ultimaComunicacion: 'Hoy, 3:42 PM',
    ultimaUbicacion: 'Neiva, Huila',
  };

  // ── ACTIVIDAD RECIENTE ────────────────────────────
  // Solo la alerta usa el rojo de peligro; el resto se queda
  // en la paleta principal para no sobrecargar la vista.
  actividadReciente: ActividadItem[] = [
    { icon: 'ti-alert-octagon', color: 'peligro',   titulo: 'Alerta de emergencia',              fecha: '28 ago. 2026 · 8:42 PM · Neiva, Huila' },
    { icon: 'ti-camera',        color: 'principal', titulo: 'Evidencia agregada',                 fecha: '28 ago. 2026 · 8:45 PM' },
    { icon: 'ti-map-pin',       color: 'exito',      titulo: 'Ubicación registrada',               fecha: '28 ago. 2026 · 8:42 PM' },
    { icon: 'ti-users',         color: 'principal', titulo: 'Contacto de emergencia notificado',   fecha: '28 ago. 2026 · 8:42 PM' },
  ];

  // ── ÚLTIMA EMERGENCIA ─────────────────────────────
  ultimaEmergencia: UltimaEmergencia = {
    fecha: '28 agosto 2026',
    hora: '8:42 PM',
    ubicacion: 'Neiva, Huila',
    activadaMediante: 'Movimiento brusco',
    contactosNotificados: 3,
    estado: 'Atendida',
  };

  // ── ÚLTIMA UBICACIÓN REGISTRADA ───────────────────
  ultimaUbicacion: UltimaUbicacion = {
    lat: 2.9273,
    lng: -75.2819,
    direccion: 'Calle 21 #5-63, Centro, Neiva, Huila, Colombia',
    fecha: 'Hoy, 3:42 PM',
    coordenadas: '2.9273, -75.2819',
    precision: '±12 metros',
  };

  // ── ACCESOS RÁPIDOS ───────────────────────────────
  accesosRapidos: AccesoRapido[] = [
    { icon: 'ti-alert-triangle', color: 'peligro',     label: 'Mis emergencias', sub: 'Ver historial',    route: '/dashboard/alert-history' },
    { icon: 'ti-folder',         color: 'exito',       label: 'Evidencias',      sub: 'Ver mis archivos', route: '/dashboard/evidence' },
    { icon: 'ti-users',          color: 'principal',   label: 'Contactos',       sub: 'Gestionar',        route: '/dashboard/emergency-contacts' },
    { icon: 'ti-map-pin',        color: 'acento',      label: 'Ubicación',       sub: 'Ver mapa',         route: '/dashboard/ubicacion' },
    { icon: 'ti-phone',          color: 'advertencia', label: 'Asistencia',      sub: 'Recursos y ayuda', route: '/dashboard/assistance' },
  ];

  // ── ACCIONES RÁPIDAS ──────────────────────────────
  accionesRapidas: AccionRapida[] = [
    { icon: 'ti-file-text', label: 'Generar informe de emergencia',   route: '/dashboard/informe', disabled: true },
    { icon: 'ti-book',      label: 'Ver tutorial nuevamente',          route: '/dashboard/tutorial', disabled: true },
    { icon: 'ti-user',      label: 'Actualizar información personal',  route: '/dashboard/settings' },
  ];

  ngOnInit(): void {
    this.cargarEstadoSeguridad();
  }

  /** Cargar estado de seguridad desde el backend */
  private cargarEstadoSeguridad(): void {
    this.isLoadingStatus = true;
    
    this.securityStatusService.getSecurityStatus()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (estado: EstadoSeguridad) => {
          // Mapear requisitos a items de seguridad
          this.estadoSeguridad = estado.requisitos.map(req => ({
            icon: req.icon,
            valor: req.valor,
            descripcion: req.label,
            configurado: req.cumplido,
            tooltip: req.cumplido 
              ? `${req.label}: ${req.valor}` 
              : `${req.label}: ${req.valor} (requiere atención)`
          }));

          // Establecer estado general
          const nivelTextos = {
            seguro: 'Tu cuenta está protegida',
            advertencia: 'Requiere atención',
            critico: 'Configuración incompleta'
          };

          const iconos = {
            seguro: 'ti-shield-check',
            advertencia: 'ti-alert-triangle',
            critico: 'ti-alert-octagon'
          };

          this.estadoGeneral = {
            nivel: nivelTextos[estado.nivel],
            color: estado.color,
            icono: iconos[estado.nivel],
            porcentaje: estado.porcentaje
          };

          this.isLoadingStatus = false;
        },
        error: (err) => {
          console.error('Error al cargar estado de seguridad:', err);
          // Mantener datos de fallback estáticos
          this.estadoSeguridad = [
            { icon: 'ti-users', valor: '0', descripcion: 'Contactos de emergencia', configurado: false },
            { icon: 'ti-shield-check', valor: 'No configurado', descripcion: 'Método de activación', configurado: false },
            { icon: 'ti-map-pin', valor: 'Inactiva', descripcion: 'Ubicación', configurado: false },
            { icon: 'ti-bell', valor: 'Inactivas', descripcion: 'Notificaciones', configurado: false },
          ];
          this.estadoGeneral = {
            nivel: 'Error al cargar',
            color: 'rojo',
            icono: 'ti-alert-octagon',
            porcentaje: 0
          };
          this.isLoadingStatus = false;
        }
      });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.inicializarMiniMapa();
      this.cargarZonasPeligrosas();
    }, 100);
  }

  /** Mapa de ancho completo: muestra el marcador con más detalle */
  private inicializarMiniMapa(): void {
    this.map = L.map('home-mini-map', {
      center: [this.ultimaUbicacion.lat, this.ultimaUbicacion.lng],
      zoom: 15,
      zoomControl: true,
      scrollWheelZoom: true,
      dragging: true,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: true,
      touchZoom: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; <a href="https://www.google.com/maps">Google Maps</a>',
    }).addTo(this.map);

    // Marcador personalizado violeta para mi ubicación
    this.crearMarcadorUbicacion();
  }

  /** Crear marcador violeta personalizado para mi ubicación */
  private crearMarcadorUbicacion(): void {
    if (!this.map) return;

    const iconoVioleta = L.divIcon({
      className: '',
      html: `
        <div style="position: relative; width: 36px; height: 50px;">
          <!-- Pin en forma de gota/lágrima -->
          <svg width="36" height="50" viewBox="0 0 36 50" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3));">
            <!-- Gradiente violeta -->
            <defs>
              <linearGradient id="gradientPin" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#6d28d9;stop-opacity:1" />
              </linearGradient>
            </defs>
            <!-- Forma de pin -->
            <path d="M18 0 C8 0 0 8 0 18 C0 28 18 50 18 50 C18 50 36 28 36 18 C36 8 28 0 18 0 Z" 
                  fill="url(#gradientPin)" 
                  stroke="white" 
                  stroke-width="2"/>
            <!-- Círculo interior blanco -->
            <circle cx="18" cy="18" r="8" fill="white"/>
            <!-- Punto violeta en el centro -->
            <circle cx="18" cy="18" r="4" fill="#6d28d9"/>
          </svg>
          
          <!-- Indicador verde pulsante (activo) -->
          <div style="
            position: absolute;
            top: 4px;
            right: 2px;
            width: 12px;
            height: 12px;
            background: #5910b9;
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 0 0 0 rgba(89, 16, 185, 0.7);
            animation: pulse 2s infinite;
          "></div>
        </div>
      `,
      iconSize: [36, 50],
      iconAnchor: [18, 50],
      popupAnchor: [0, -50],
    });

    this.userMarker = L.marker([this.ultimaUbicacion.lat, this.ultimaUbicacion.lng], { icon: iconoVioleta })
      .addTo(this.map)
      .bindPopup(`
        <div style="text-align: center; min-width: 200px;">
          <strong style="color: #6d28d9; font-size: 14px;">📍 Mi ubicación</strong><br>
          <span style="font-size: 12px; color: #666;">${this.ultimaUbicacion.direccion}</span><br>
          <small style="color: #999;">${this.ultimaUbicacion.fecha}</small>
        </div>
      `);
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

  /** Calcular distancias de zonas desde la ubicación del usuario */
  private calcularDistancias(): void {
    this.zonas = this.zonas.map(zona => ({
      ...zona,
      distanceKm: this.calcularDistanciaKm(
        this.ultimaUbicacion.lat,
        this.ultimaUbicacion.lng,
        zona.lat,
        zona.lng
      )
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

  /** Refrescar ubicación del dispositivo */
  refrescarUbicacion(): void {
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;

    // Simular obtención de nueva ubicación
    // TODO: Reemplazar con llamada real al servicio de ubicación
    setTimeout(() => {
      // Actualizar coordenadas (ejemplo con pequeña variación)
      this.ultimaUbicacion = {
        ...this.ultimaUbicacion,
        lat: this.ultimaUbicacion.lat + (Math.random() - 0.5) * 0.001,
        lng: this.ultimaUbicacion.lng + (Math.random() - 0.5) * 0.001,
        fecha: new Date().toLocaleString('es-CO', { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
      };

      // Actualizar mapa
      if (this.map && this.userMarker) {
        const newLatLng: L.LatLngExpression = [this.ultimaUbicacion.lat, this.ultimaUbicacion.lng];
        this.userMarker.setLatLng(newLatLng);
        this.map.panTo(newLatLng);
        
        // Actualizar popup
        this.userMarker.setPopupContent(`
          <div style="text-align: center; min-width: 200px;">
            <strong style="color: #6d28d9; font-size: 14px;">📍 Mi ubicación</strong><br>
            <span style="font-size: 12px; color: #666;">${this.ultimaUbicacion.direccion}</span><br>
            <small style="color: #999;">${this.ultimaUbicacion.fecha}</small>
          </div>
        `);
      }

      this.isRefreshing = false;
    }, 1500);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}