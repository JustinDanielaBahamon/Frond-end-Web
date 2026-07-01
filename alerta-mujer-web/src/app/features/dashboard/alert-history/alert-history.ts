import { Component, OnDestroy, OnInit, inject } from '@angular/core';
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

@Component({
  selector: 'app-alert-history',
  imports: [CommonModule, NgClass],
  templateUrl: './alert-history.html',
  styleUrl: './alert-history.scss',
})
export class AlertHistory implements OnInit, OnDestroy {

  private alertsService = inject(AlertsService);
  private authService = inject(AuthService);

  alertas: Alerta[] = [];
  cargando = true;
  error = false;

  totalAlertas = 0;
  alertasEsteMes = 0;
  alertasPendientes = 0;
  alertasAtendidas = 0;

  tipoBadge: Record<string, string> = {
    'SOS': 'badge-sos',
    'Medical': 'badge-medical',
    'Robo': 'badge-robo',
    'Acoso': 'badge-acoso',
  };

  estadoBadge: Record<string, string> = {
    'Atendida': 'badge-ok',
    'Pendiente': 'badge-pendiente',
  };

  alertaSeleccionada: Alerta | null = null;
  modalAbierto = false;

  private map: L.Map | null = null;
  private mapInitialized = false;

  ngOnInit() {
    this.authService.currentUser$.subscribe((usuario) => {
      if (!usuario) {
        this.error = true;
        this.cargando = false;
        return;
      }

      this.alertsService.getByUsuario(usuario.id).subscribe({
        next: (data) => {
          this.alertas = data;
          this.calcularStats(data);
          this.cargando = false;
        },
        error: () => {
          this.error = true;
          this.cargando = false;
        },
      });
    });
  }

  private calcularStats(alertas: Alerta[]) {
    this.totalAlertas = alertas.length;
    this.alertasPendientes = alertas.filter(a => a.estado === 'Pendiente').length;
    this.alertasAtendidas = alertas.filter(a => a.estado === 'Atendida').length;

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

  abrirModal(alerta: Alerta) {
    this.alertaSeleccionada = alerta;
    this.modalAbierto = true;
    this.mapInitialized = false;

    setTimeout(() => {
      const el = document.getElementById('leaflet-map');
      if (el && !this.mapInitialized) {
        this.inicializarMapa(alerta.lat, alerta.lng);
        this.mapInitialized = true;
      }
    }, 50);
  }

  cerrarModal() {
    this.destruirMapa();
    this.modalAbierto = false;
    this.alertaSeleccionada = null;
  }

  private inicializarMapa(lat: number, lng: number) {
    this.destruirMapa();

    this.map = L.map('leaflet-map', {
      center: [lat, lng],
      zoom: 15,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(this.map);

    L.marker([lat, lng], { icon: iconDefault })
      .addTo(this.map)
      .bindPopup('Ubicación de la alerta')
      .openPopup();
  }

  private destruirMapa() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  ngOnDestroy() {
    this.destruirMapa();
  }

  toggleFullscreen() {
    const el = document.getElementById('leaflet-map');
    if (!el) return;

    if (!document.fullscreenElement) {
      el.requestFullscreen();
    } else {
      document.exitFullscreen();
    }

    setTimeout(() => this.map?.invalidateSize(), 300);
  }
}