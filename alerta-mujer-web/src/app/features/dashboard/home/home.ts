import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';

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
    direccion: 'Neiva, Huila',
    fecha: 'Hoy, 3:42 PM',
  };

  // ── ACCESOS RÁPIDOS ───────────────────────────────
  accesosRapidos: AccesoRapido[] = [
    { icon: 'ti-alert-triangle', color: 'peligro',     label: 'Mis emergencias', sub: 'Ver historial',    route: '/dashboard/mis-emergencias' },
    { icon: 'ti-folder',         color: 'exito',       label: 'Evidencias',      sub: 'Ver mis archivos', route: '/dashboard/evidencias' },
    { icon: 'ti-users',          color: 'principal',   label: 'Contactos',       sub: 'Gestionar',        route: '/dashboard/contactos' },
    { icon: 'ti-map-pin',        color: 'acento',      label: 'Ubicación',       sub: 'Ver mapa',         route: '/dashboard/ubicacion' },
    { icon: 'ti-phone',          color: 'advertencia', label: 'Asistencia',      sub: 'Recursos y ayuda', route: '/dashboard/asistencia' },
  ];

  // ── ACCIONES RÁPIDAS ──────────────────────────────
  accionesRapidas: AccionRapida[] = [
    { icon: 'ti-file-text', label: 'Generar informe de emergencia',   route: '/dashboard/informe' },
    { icon: 'ti-book',      label: 'Ver tutorial nuevamente',          route: '/dashboard/tutorial' },
    { icon: 'ti-user',      label: 'Actualizar información personal',  route: '/dashboard/perfil' },
  ];

  ngAfterViewInit(): void {
    setTimeout(() => this.inicializarMiniMapa(), 100);
  }

  /** Mini-mapa de solo lectura: un único marcador, sin controles,
   * pensado como vista previa que enlaza a "Ver mapa". */
  private inicializarMiniMapa(): void {
    this.map = L.map('home-mini-map', {
      center: [this.ultimaUbicacion.lat, this.ultimaUbicacion.lng],
      zoom: 14,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(this.map);

    const icono = L.divIcon({
      className: '',
      html: `<div class="home-mini-map__pin"><i class="ti ti-map-pin-filled"></i></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    L.marker([this.ultimaUbicacion.lat, this.ultimaUbicacion.lng], { icon: icono }).addTo(this.map);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}