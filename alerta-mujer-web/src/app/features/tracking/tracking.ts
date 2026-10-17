import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import { Seguimiento, TrackingService } from '../../core/services/tracking.service';

const REFRESCO_MS = 10000;

/**
 * Pantalla pública que abre un contacto de emergencia desde el correo: estado de la alerta,
 * ubicación en vivo y accesos rápidos para llamar o abrir Google Maps.
 */
@Component({
  selector: 'app-tracking',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tracking.html',
  styleUrl: './tracking.scss',
})
export class TrackingComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private trackingService = inject(TrackingService);
  private destroyRef = inject(DestroyRef);

  readonly datos = signal<Seguimiento | null>(null);
  readonly error = signal('');
  readonly cargando = signal(true);
  readonly despertando = signal(false);
  readonly ahora = signal(Date.now());

  readonly ultimo = computed(() => {
    const r = this.datos()?.recorrido ?? [];
    return r.length ? r[r.length - 1] : null;
  });

  readonly haceCuanto = computed(() => {
    const u = this.ultimo();
    if (!u) return '';
    const min = Math.max(0, Math.round((this.ahora() - u.hora.getTime()) / 60000));
    return min === 0 ? 'hace menos de un minuto' : min === 1 ? 'hace 1 minuto' : `hace ${min} minutos`;
  });

  readonly mapsUrl = computed(() => {
    const u = this.ultimo();
    return u ? `https://www.google.com/maps/search/?api=1&query=${u.lat},${u.lng}` : '';
  });

  private codigo = '';
  private mapa: L.Map | null = null;
  private capa: L.LayerGroup | null = null;
  private temporizador: ReturnType<typeof setInterval> | null = null;
  private primeraVista = true;

  ngOnInit(): void {
    this.codigo = this.route.snapshot.paramMap.get('codigo') ?? '';
    // Si el servidor (Render gratis) estaba dormido, la primera respuesta puede tardar
    const aviso = setTimeout(() => this.despertando.set(true), 4000);
    this.consultar(() => clearTimeout(aviso));
    this.destroyRef.onDestroy(() => {
      if (this.temporizador) clearInterval(this.temporizador);
      this.mapa?.remove();
    });
  }

  private consultar(alTerminar?: () => void): void {
    this.trackingService.consultar(this.codigo).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        alTerminar?.();
        this.datos.set(d);
        this.error.set('');
        this.cargando.set(false);
        this.despertando.set(false);
        this.ahora.set(Date.now());
        setTimeout(() => this.pintarMapa(d));
        if (d.activa && !this.temporizador) {
          this.temporizador = setInterval(() => this.consultar(), REFRESCO_MS);
        } else if (!d.activa && this.temporizador) {
          clearInterval(this.temporizador);
          this.temporizador = null;
        }
      },
      error: (err) => {
        alTerminar?.();
        this.cargando.set(false);
        this.despertando.set(false);
        if (err?.status === 404) {
          this.error.set('Este enlace no existe o ya venció. Los enlaces dejan de funcionar 2 horas después de que termina la alerta.');
          if (this.temporizador) clearInterval(this.temporizador);
          this.temporizador = null;
        } else if (!this.datos()) {
          this.error.set('No se pudo conectar con AlertaMujer. Revisa tu conexión e inténtalo de nuevo.');
        }
        // Con datos ya mostrados, un fallo puntual no borra la pantalla: el siguiente intento la actualiza
      },
    });
  }

  reintentar(): void {
    this.error.set('');
    this.cargando.set(true);
    this.consultar();
  }

  private pintarMapa(d: Seguimiento): void {
    const contenedor = document.getElementById('mapa-seguimiento');
    if (!contenedor || !d.recorrido.length) return;
    if (!this.mapa) {
      this.mapa = L.map(contenedor, { zoomControl: true, attributionControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(this.mapa);
      this.capa = L.layerGroup().addTo(this.mapa);
    }
    this.capa!.clearLayers();
    const puntos = d.recorrido.map((p) => L.latLng(p.lat, p.lng));
    if (puntos.length > 1) {
      L.polyline(puntos, { color: '#7c3aed', weight: 4, opacity: 0.8 }).addTo(this.capa!);
    }
    const u = puntos[puntos.length - 1];
    const precision = d.recorrido[d.recorrido.length - 1].precision;
    if (precision && precision > 0) {
      L.circle(u, { radius: precision, color: '#d946ef', weight: 1, fillOpacity: 0.12 }).addTo(this.capa!);
    }
    L.circleMarker(u, { radius: 10, color: '#fff', weight: 3, fillColor: '#d946ef', fillOpacity: 1 }).addTo(this.capa!);
    if (this.primeraVista) {
      this.mapa.setView(u, 16);
      this.primeraVista = false;
    } else {
      this.mapa.panTo(u);
    }
    this.mapa.invalidateSize();
  }
}
