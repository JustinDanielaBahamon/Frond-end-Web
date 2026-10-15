import { Component, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { NearbyZoneService } from '../../../core/services/nearby-zone.service';
import { NearbyZone } from '../../../core/models/nearby-zone.model';

interface SeguridadItem {
  icon: string;
  valor: string;
  descripcion: string;
  configurado: boolean;
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
export class Home implements AfterViewInit, OnDestroy {

  private map: L.Map | null = null;
  private zoneService = inject(NearbyZoneService);
  private zonas: NearbyZone[] = [];
  private userMarker: L.Marker | null = null;
  private zoneCircles: L.Circle[] = [];
  
  // Estado público para el template
  isRefreshing = false;

  // ── ESTADO DE SEGURIDAD ───────────────────────────
  // Refleja qué tan configurada está la cuenta: cada item ya
  // trae su check en verde cuando la usuaria completó ese paso.
  estadoSeguridad: SeguridadItem[] = [
    { icon: 'ti-users',        valor: '3',            descripcion: 'Contactos de emergencia', configurado: true },
    { icon: 'ti-shield-check', valor: 'Movimiento',   descripcion: 'Método de activación',     configurado: true },
    { icon: 'ti-map-pin',      valor: 'Ubicación',    descripcion: 'activa',                   configurado: true },
    { icon: 'ti-bell',         valor: 'Notificaciones', descripcion: 'activas',                configurado: true },
    { icon: 'ti-folder',       valor: '8',            descripcion: 'Evidencias almacenadas',   configurado: true },
  ];

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
        <div style="position: relative;">
          <div style="
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #6d28d9 0%, #a855f7 100%);
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(109, 40, 217, 0.4);
          ">
            <i class="ti ti-map-pin-filled" style="color: white; font-size: 20px;"></i>
          </div>
          <div style="
            position: absolute;
            top: -8px;
            right: -8px;
            width: 16px;
            height: 16px;
            background: #10b981;
            border: 2px solid white;
            border-radius: 50%;
            animation: pulse 2s infinite;
          "></div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40],
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

  /** Cargar y mostrar zonas peligrosas del backend */
  private cargarZonasPeligrosas(): void {
    if (!this.map) return;

    // Obtener zonas del backend (usar userId real cuando esté disponible)
    this.zoneService.getByUser(1).subscribe({
      next: (zonas) => {
        this.zonas = zonas;
        this.dibujarZonasEnMapa();
      },
      error: (err) => {
        console.error('Error al cargar zonas:', err);
      }
    });
  }

  /** Dibujar zonas en el mapa con colores según el tipo */
  private dibujarZonasEnMapa(): void {
    if (!this.map) return;

    // Limpiar zonas anteriores
    this.zoneCircles.forEach(circle => circle.remove());
    this.zoneCircles = [];

    this.zonas.forEach(zona => {
      if (!zona.radiusMeters || !this.map) return;

      const config = this.obtenerConfigZona(zona.type);
      
      const circle = L.circle([zona.lat, zona.lng], {
        radius: zona.radiusMeters,
        color: config.borderColor,
        fillColor: config.fillColor,
        fillOpacity: 0.25,
        weight: 2,
      }).addTo(this.map);

      circle.bindPopup(`
        <div style="min-width: 180px;">
          <strong style="color: ${config.borderColor};">${config.icon} ${zona.name}</strong><br>
          <span style="font-size: 12px; color: #666;">${config.label}</span><br>
          ${zona.description ? `<p style="font-size: 11px; margin: 5px 0; color: #888;">${zona.description}</p>` : ''}
          ${zona.address ? `<small style="color: #999;">📍 ${zona.address}</small>` : ''}
        </div>
      `);

      this.zoneCircles.push(circle);
    });
  }

  /** Obtener configuración de color e icono según el tipo de zona */
  private obtenerConfigZona(type: NearbyZone['type']): { 
    fillColor: string; 
    borderColor: string; 
    label: string; 
    icon: string;
  } {
    const configs = {
      risk: { 
        fillColor: '#dc2626', 
        borderColor: '#991b1b', 
        label: 'Zona de riesgo', 
        icon: '⚠️' 
      },
      safe: { 
        fillColor: '#16a34a', 
        borderColor: '#15803d', 
        label: 'Zona segura', 
        icon: '✅' 
      },
      help: { 
        fillColor: '#0ea5e9', 
        borderColor: '#0284c7', 
        label: 'Punto de ayuda', 
        icon: '🆘' 
      },
      policia: { 
        fillColor: '#9333ea', 
        borderColor: '#7e22ce', 
        label: 'Estación de policía', 
        icon: '👮' 
      },
      asistencia: { 
        fillColor: '#3b82f6', 
        borderColor: '#2563eb', 
        label: 'Centro de asistencia', 
        icon: '🏥' 
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