import { Component } from '@angular/core';

import { CommonModule, NgClass } from '@angular/common';
import { SafeUrlPipe } from '../../../shared/pipes/safe-url.pipe';

@Component({
  selector: 'app-alert-history',
  imports: [CommonModule, NgClass, SafeUrlPipe],
  templateUrl: './alert-history.html',
  styleUrl: './alert-history.scss',
})

export class AlertHistory {
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
    'Sacudida': 'badge-sacudida'
  };

  estadoBadge: Record<string, string> = {
    'Atendida': 'badge-ok',
    'Pendiente': 'badge-pendiente',
    'Fallido': 'badge-fallido'
  };

  alertaSeleccionada: any = null;
  modalAbierto = false;

  abrirModal(alerta: any) {
    this.alertaSeleccionada = alerta;
    this.modalAbierto = true;
  }

  cerrarModal() {
    this.modalAbierto = false;
    this.alertaSeleccionada = null;
  }

  getMapUrl(lat: number, lng: number): string {
    return `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  }
}