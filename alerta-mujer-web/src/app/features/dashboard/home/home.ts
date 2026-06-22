import { Component, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, NgClass, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements AfterViewInit, OnDestroy {

  @ViewChild('mapWrapper') mapWrapper!: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  panelAbierto = false;

  zonas = [
    { lat: 2.2964, lng: -75.0199, nombre: 'Campoalegre Centro',     alertas: 24, porcentaje: 42, nivel: 'alto',  color: '#ef4444' },
    { lat: 2.9273, lng: -75.2819, nombre: 'Av. Santander, Neiva',   alertas: 15, porcentaje: 26, nivel: 'medio', color: '#f59e0b' },
    { lat: 2.9356, lng: -75.2945, nombre: 'Terminal Neiva',          alertas: 10, porcentaje: 17, nivel: 'medio', color: '#f59e0b' },
    { lat: 2.1978, lng: -75.6273, nombre: 'Parque Central, Garzón', alertas: 6,  porcentaje: 10, nivel: 'bajo',  color: '#10b981' },
    { lat: 2.2971, lng: -75.0210, nombre: 'Calle 15, Campoalegre',  alertas: 3,  porcentaje: 5,  nivel: 'bajo',  color: '#10b981' },
  ];

  chartData = [
    { mes: 'J', valor: 15 }, { mes: 'F', valor: 18 }, { mes: 'M', valor: 22 },
    { mes: 'A', valor: 25 }, { mes: 'M', valor: 20 }, { mes: 'J', valor: 10 },
    { mes: 'J', valor: 12 }, { mes: 'A', valor: 20 }, { mes: 'S', valor: 18 },
    { mes: 'O', valor: 22 }, { mes: 'N', valor: 14 }, { mes: 'D', valor: 9  },
  ];

  yAxis = [30, 25, 20, 15, 10, 5, 0];

  actividad = [
    { n: 1, tipo: 'SOS',               ubicacion: 'Cra 7 #34-12',    fecha: 'Hoy 10:32 AM',   estado: 'VALIDADA' },
    { n: 2, tipo: 'Perímetro check',   ubicacion: 'Calle 12 #45-67', fecha: 'Hoy 09:15 AM',   estado: 'OK' },
    { n: 3, tipo: 'Ubicación manual',  ubicacion: 'Parque Central',   fecha: 'Ayer 14:27 PM',  estado: 'OK' },
    { n: 4, tipo: 'Contacto agregado', ubicacion: 'N/A',              fecha: 'Ayer 11:03 AM',  estado: 'OK' },
    { n: 5, tipo: 'Check-in diario',   ubicacion: 'N/A',              fecha: 'Lunes 18:45 PM', estado: 'OK' },
  ];

  togglePanel(): void {
    this.panelAbierto = !this.panelAbierto;
    setTimeout(() => this.map?.invalidateSize(), 300);
  }

  toggleFullscreen(): void {
    const el = this.mapWrapper.nativeElement;

    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => {
        setTimeout(() => this.map?.invalidateSize(), 200);
      }).catch(err => {
        console.error('Error al entrar en fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setTimeout(() => this.map?.invalidateSize(), 200);
      }).catch(err => {
        console.error('Error al salir de fullscreen:', err);
      });
    }
  }

  irAZona(zona: any): void {
    if (this.map) {
      this.map.flyTo([zona.lat, zona.lng], 13, { duration: 1 });
      this.map.eachLayer((layer: any) => {
        if (layer instanceof L.Circle) {
          const latlng = layer.getLatLng();
          if (
            Math.abs(latlng.lat - zona.lat) < 0.001 &&
            Math.abs(latlng.lng - zona.lng) < 0.001
          ) {
            layer.openPopup();
          }
        }
      });
    }
  }

  ngAfterViewInit(): void {
    const iconDefault = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });
    L.Marker.prototype.options.icon = iconDefault;
    setTimeout(() => this.inicializarMapa(), 100);
  }

  private inicializarMapa(): void {
    this.map = L.map('dashboard-map', {
      center: [2.6, -75.15],
      zoom: 8,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(this.map);

    this.zonas.forEach(zona => {
      L.circle([zona.lat, zona.lng], {
        color: zona.color,
        fillColor: zona.color,
        fillOpacity: 0.25,
        weight: 2,
        radius: zona.alertas * 300,
      })
      .addTo(this.map!)
      .bindPopup(`
        <div style="font-family:sans-serif; min-width:170px; padding:4px">
          <strong style="color:#2d1457; font-size:13px">${zona.nombre}</strong><br/>
          <hr style="border:none; border-top:1px solid #ede9fe; margin:6px 0"/>
          <span style="color:#7c3aed">🔔 ${zona.alertas} alertas</span><br/>
          <span style="color:#be185d">📊 ${zona.porcentaje}% del total</span><br/>
          <span style="
            display:inline-block;
            margin-top:6px;
            padding:2px 10px;
            border-radius:50px;
            font-size:11px;
            font-weight:700;
            background:${zona.color}22;
            color:${zona.color};
            text-transform:uppercase;
          ">● Riesgo ${zona.nivel}</span>
        </div>
      `);

      const nivelIcon = L.divIcon({
        className: '',
        html: `
          <div style="
            background:${zona.color};
            border:2px solid #fff;
            border-radius:50%;
            width:14px;
            height:14px;
            box-shadow:0 1px 4px rgba(0,0,0,0.35);
          "></div>
        `,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      L.marker([zona.lat, zona.lng], { icon: nivelIcon })
        .addTo(this.map!)
        .bindTooltip(`<b>${zona.nombre}</b><br/>Riesgo ${zona.nivel}`, {
          direction: 'top',
          offset: [0, -10],
        });
    });
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}