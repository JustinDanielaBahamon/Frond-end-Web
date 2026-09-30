import { Component, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { AlertService } from '../../../core/services/alert.service';

interface ActividadItem {
  icon: string;
  color: 'peligro' | 'exito' | 'principal';
  titulo: string;
  fecha: string;
}

interface UbicacionActual {
  lat: number;
  lng: number;
  direccion: string;
  ultimaActualizacion: string;
  precision: number;
}

interface EstadoApp {
  ubicacionCompartida: boolean;
  appActiva: boolean;
}

interface ResumenCuenta {
  contactos: number;
  dispositivos: number;
  recorridos: number;
  evidencias: number;
}

interface AccesoRapido {
  icon: string;
  color: 'peligro' | 'exito' | 'principal' | 'acento' | 'advertencia';
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
  private alertService = inject(AlertService);
  private map: L.Map | null = null;

  // Estado de alerta activa
  alertaActiva$ = this.alertService.alertaActiva$;
  sincronizacion$ = this.alertService.sincronizacion$;

  // Estado local para UI
  activandoAlerta = false;
  mostrarModalAlerta = false;
  segundosRestantes = 182; // 3:02 minutos como en el móvil
  contactosInsuficientes = false;

  // ── UBICACIÓN ACTUAL ───────────────────────────────
  ubicacionActual: UbicacionActual = {
    lat: 2.9273,
    lng: -75.2819,
    direccion: 'Neiva, Barrio Centro',
    ultimaActualizacion: 'Hace 2 minutos',
    precision: 15,
  };

  // TODO: Conectar con backend para obtener ubicación real del usuario
  // Cuando el backend esté disponible, estos datos deberán venir de geolocalización o API
  // Ejemplo: this.ubicacionActual = await this.apiService.getUbicacionActual();

  // ── ESTADO DE LA APP ───────────────────────────────
  estadoApp: EstadoApp = {
    ubicacionCompartida: true,
    appActiva: true,
  };

  // TODO: Conectar con backend para obtener estado real de la app
  // Cuando el backend esté disponible, estos valores deberán venir de una API
  // Ejemplo: this.estadoApp = await this.apiService.getEstadoApp();

  // ── ACTIVIDAD RECIENTE ────────────────────────────
  actividadReciente: ActividadItem[] = [
    { icon: 'ti-map-pin', color: 'exito', titulo: 'Ubicación actualizada', fecha: 'Hace 5 minutos' },
    { icon: 'ti-users', color: 'principal', titulo: 'Contacto de emergencia notificado', fecha: 'Hace 1 hora' },
    { icon: 'ti-route', color: 'principal', titulo: 'Recorrido registrado', fecha: 'Hace 2 horas' },
    { icon: 'ti-alert-triangle', color: 'peligro', titulo: 'Alerta de prueba', fecha: 'Ayer' },
  ];

  // ── RESUMEN DE CUENTA ─────────────────────────────
  resumenCuenta: ResumenCuenta = {
    contactos: 3,
    dispositivos: 1,
    recorridos: 12,
    evidencias: 8,
  };

  // ── ACCESOS RÁPIDOS ───────────────────────────────
  accesosRapidos: AccesoRapido[] = [
    { icon: 'ti-alert-triangle', color: 'peligro', label: 'Mis emergencias', route: '/dashboard/alert-history' },
    { icon: 'ti-folder', color: 'exito', label: 'Evidencias', route: '/dashboard/evidence' },
    { icon: 'ti-users', color: 'principal', label: 'Contactos', route: '/dashboard/emergency-contacts' },
    { icon: 'ti-map-pin', color: 'acento', label: 'Ubicación', route: '/dashboard/ubicacion' },
    { icon: 'ti-phone', color: 'advertencia', label: 'Asistencia', route: '/dashboard/assistance' },
  ];

  ngAfterViewInit(): void {
    // Solo inicializar el mapa si la ubicación está compartida y la app está activa
    if (this.estadoApp.ubicacionCompartida && this.estadoApp.appActiva) {
      setTimeout(() => this.inicializarMapaUbicacion(), 100);
    }
  }

  /** Mapa de ubicación actual: muestra la posición en tiempo real */
  private inicializarMapaUbicacion(): void {
    try {
      this.map = L.map('home-location-map', {
        center: [this.ubicacionActual.lat, this.ubicacionActual.lng],
        zoom: 15,
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
        html: `<div style="color: #8b5cf6; font-size: 2rem; display: flex; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));"><i class="ti ti-map-pin-filled"></i></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      L.marker([this.ubicacionActual.lat, this.ubicacionActual.lng], { icon: icono }).addTo(this.map);

      // Forzar redraw del mapa después de la inicialización
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
        }
      }, 200);
    } catch (error) {
      console.error('Error al inicializar el mapa:', error);
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  /** Cambia el estado de la app para demostración */
  cambiarEstadoApp(ubicacionCompartida: boolean, appActiva: boolean): void {
    this.estadoApp = {
      ubicacionCompartida,
      appActiva,
    };
  }

  /** Simula cambio de estado (para pruebas) */
  simularEstadoInactivo(): void {
    this.cambiarEstadoApp(false, false);
  }

  /** Simula estado activo (para pruebas) */
  simularEstadoActivo(): void {
    this.cambiarEstadoApp(true, true);
    // Reinicializar el mapa cuando se activa
    setTimeout(() => this.inicializarMapaUbicacion(), 100);
  }

  /** Activar alerta de emergencia */
  activarAlerta(): void {
    console.log('🔴 Botón activar alerta presionado');
    if (this.activandoAlerta) {
      console.log('⚠️ Ya se está activando una alerta');
      return;
    }

    this.activandoAlerta = true;
    const usuarioId = 1; // TODO: Obtener del auth service

    console.log('� Verificando contactos de emergencia...');
    this.alertService.verificarContactosSuficientes(usuarioId).subscribe({
      next: (suficientes) => {
        if (!suficientes) {
          console.warn('⚠️ Contactos insuficientes');
          this.contactosInsuficientes = true;
          this.activandoAlerta = false;
          return;
        }

        console.log('✅ Contactos suficientes, procediendo a activar alerta');
        const ubicacion = {
          lat: this.ubicacionActual.lat,
          lng: this.ubicacionActual.lng,
          direccion: this.ubicacionActual.direccion
        };

        // Usar modo simulación para demostración
        console.log('📡 Usando modo simulación (para demostración)');
        this.alertService.activarAlertaSimulada(ubicacion);
        this.mostrarModalAlerta = true;
        this.iniciarCuentaRegresiva();
        this.activandoAlerta = false;
      },
      error: (error) => {
        console.error('❌ Error al verificar contactos:', error);
        this.activandoAlerta = false;
      }
    });
  }

  /** Iniciar cuenta regresiva similar al móvil */
  iniciarCuentaRegresiva(): void {
    this.segundosRestantes = 182; // 3:02 minutos como en el móvil

    const intervalo = setInterval(() => {
      if (this.segundosRestantes > 0) {
        this.segundosRestantes--;
      } else {
        clearInterval(intervalo);
      }
    }, 1000);
  }

  /** Formatear tiempo como en el móvil (mm:ss) */
  get tiempoFormateado(): string {
    const minutos = Math.floor(this.segundosRestantes / 60);
    const segundos = this.segundosRestantes % 60;
    return `${minutos}:${String(segundos).padStart(2, '0')}`;
  }

  /** Desactivar alerta de emergencia */
  desactivarAlerta(): void {
    this.alertService.desactivarAlerta().subscribe({
      next: () => {
        console.log('✅ Alerta desactivada exitosamente');
      },
      error: (error) => {
        console.error('❌ Error al desactivar alerta:', error);
      }
    });
  }

  /** Verificar si hay alerta activa */
  hayAlertaActiva(): boolean {
    return this.alertService.hayAlertaActiva();
  }
}