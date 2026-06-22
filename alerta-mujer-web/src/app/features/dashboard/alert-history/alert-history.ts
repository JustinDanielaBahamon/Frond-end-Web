import { Component, OnDestroy } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import * as L from 'leaflet';

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

export class AlertHistory implements OnDestroy {

  alertas = [
    { id: '024', fecha: '13 jun 2026', hora: '10:32 AM', tipo: 'Botón de activación', ubicacion: 'Cra 5 #12-34, Campoalegre', estado: 'Pendiente', lat: 2.2964, lng: -75.0199, desc: 'La usuaria presionó el botón de emergencia.' },
    { id: '023', fecha: '12 jun 2026', hora: '08:15 PM', tipo: 'Sacudida', ubicacion: 'Av. Santander, Neiva', estado: 'Atendida', lat: 2.9273, lng: -75.2819, desc: 'El sensor detectó un movimiento brusco del dispositivo.' },
    { id: '022', fecha: '10 jun 2026', hora: '03:47 PM', tipo: 'Wigert', ubicacion: 'Parque Central, Garzón', estado: 'Atendida', lat: 2.1978, lng: -75.6273, desc: 'Alerta activada desde el widget del dispositivo.' },
    { id: '021', fecha: '08 jun 2026', hora: '11:20 AM', tipo: 'Botón de activación', ubicacion: 'Terminal de Transporte, Neiva', estado: 'Fallido', lat: 2.9356, lng: -75.2945, desc: 'No se pudo notificar a los contactos de confianza.' },
    { id: '020', fecha: '05 jun 2026', hora: '07:05 PM', tipo: 'Sacudida', ubicacion: 'Calle 15 #8-22, Campoalegre', estado: 'Atendida', lat: 2.2971, lng: -75.0210, desc: 'Alerta de emergencia atendida por contacto de confianza.' },
  ];

  tipoBadge: Record<string, string> = {
    'Botón de activación': 'badge-boton',
    'Wigert': 'badge-wigert',
    'Sacudida': 'badge-sacudida',
  };

  estadoBadge: Record<string, string> = {
    'Atendida': 'badge-ok',
    'Pendiente': 'badge-pendiente',
    'Fallido': 'badge-fallido',
  };

  alertaSeleccionada: any = null;
  modalAbierto = false;

  private map: L.Map | null = null;
  private mapInitialized = false;

  abrirModal(alerta: any) {
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

  // le dice a Leaflet que recalcule el tamaño después del cambio
  setTimeout(() => this.map?.invalidateSize(), 300);
}
}

