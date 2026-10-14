import {
  AfterViewInit, Component, ElementRef, Injector, OnDestroy, OnInit, ViewChild,
  computed, effect, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { PhoneLocationService } from '../../../core/services/phone.location.services';
import { NearbyZoneService } from '../../../core/services/nearby-zone.service';
import { FrequentPlaceService } from '../../../core/services/frequent-places.service';
import { RecorridosService } from '../../../core/services/recorridos.service';
import { AuthService } from '../../../core/auth/auth.service';
import { GeocodingService, Lugar } from '../../../core/services/geocoding.service';
import { UbicacionEntry } from '../../../core/models/location.model';
import { NearbyZone } from '../../../core/models/nearby-zone.model';
import { FrequentPlace } from '../../../core/models/frequent-place.model';

type SubTab = 'mapa' | 'historial';
type EstadoGps = 'buscando' | 'activo' | 'denegado' | 'no-disponible';

/** Capas que la usuaria puede prender/apagar (se recuerdan en este navegador). */
interface Capas {
  recorridos: boolean;
  soloImportantes: boolean;
  ubicaciones: boolean;
  zonas: boolean;
}

const CAPAS_KEY = 'alerta_mujer_capas_mapa';
const CAPAS_DEFECTO: Capas = { recorridos: true, soloImportantes: false, ubicaciones: true, zonas: true };
// Neiva (Huila): mismo centro por defecto que la app móvil
const CENTRO_POR_DEFECTO: L.LatLngTuple = [2.9273, -75.2819];
const COLORES_RECORRIDO = ['#a78bfa', '#38bdf8', '#f472b6', '#34d399'];

// Colores alineados con la app móvil
export const ZONA_ESTILO: Record<NearbyZone['type'], { color: string; etiqueta: string }> = {
  safe: { color: '#16a34a', etiqueta: 'Zona segura' },
  risk: { color: '#dc2626', etiqueta: 'Zona de riesgo' },
  help: { color: '#0ea5e9', etiqueta: 'Punto de ayuda' },
  asistencia: { color: '#3b82f6', etiqueta: 'Asistencia' },
  policia: { color: '#9333ea', etiqueta: 'Policía' },
};
const RIESGO_LUGAR: Record<string, { color: string; etiqueta: string }> = {
  muy_segura: { color: '#16a34a', etiqueta: 'Muy segura' },
  moderada: { color: '#f59e0b', etiqueta: 'Moderada' },
  muy_insegura: { color: '#dc2626', etiqueta: 'Muy insegura' },
};

const phoneIcon = L.divIcon({
  className: '',
  html: `<div class="mu-phone-marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

// Solo se vuelve a pedir la dirección si la usuaria se movió más de esto
const METROS_PARA_REGEOCODIFICAR = 30;

const youIcon = L.divIcon({
  className: '',
  html: `<div class="mu-you-marker"><span></span></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

@Component({
  selector: 'app-my-location',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-location.html',
  styleUrl: './my-location.scss',
})
export class MyLocationComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  private phoneLocationService = inject(PhoneLocationService);
  private zoneService = inject(NearbyZoneService);
  private frequentPlaceService = inject(FrequentPlaceService);
  private recorridosService = inject(RecorridosService);
  private authService = inject(AuthService);
  private geocoding = inject(GeocodingService);
  private injector = inject(Injector);

  private map: L.Map | null = null;
  private resizeObserver?: ResizeObserver;
  private capaYo = L.layerGroup();
  private capaCelular = L.layerGroup();
  private ultimoGeocodificado: L.LatLng | null = null;
  private capaRecorridos = L.layerGroup();
  private capaUbicaciones = L.layerGroup();
  private capaZonas = L.layerGroup();
  private watchId: number | null = null;
  private centradoInicial = false;

  readonly MAX_RECORRIDOS = this.recorridosService.limiteRecorridos;
  readonly MAX_ESTRELLAS = this.recorridosService.limiteEstrellas;
  readonly zonaEstilo = ZONA_ESTILO;
  readonly riesgoLugar = RIESGO_LUGAR;

  activeTab = signal<SubTab>('mapa');

  // ── Ubicación en vivo (GPS de este dispositivo) ─
  estadoGps = signal<EstadoGps>('buscando');
  posicion = signal<{ lat: number; lng: number; precision: number } | null>(null);
  actualizadoEn = signal<Date | null>(null);
  seguir = signal(true);
  lugar = signal<Lugar | null>(null);
  buscandoLugar = signal(false);

  // ── Ubicación del celular (última que envió la app móvil) ─
  celular = signal<UbicacionEntry | null>(null);
  lugarCelular = signal<Lugar | null>(null);
  cargandoCelular = signal(false);
  celularConsultado = signal(false);
  errorCelular = signal(false);

  // ── Datos del mapa ─────────────────────────────
  recorridos = this.recorridosService.recorridos$;
  estrellas = computed(() => this.recorridos().filter((r) => r.importante));
  ubicaciones = signal<FrequentPlace[]>([]);
  zonas = signal<NearbyZone[]>([]);

  // ── Historial (ubicaciones reportadas por el móvil) ─
  historial = signal<UbicacionEntry[]>([]);
  lugaresHistorial = signal<Record<number, string>>({});
  cargandoHistorial = signal(true);
  errorHistorial = signal(false);

  // ── Capas ──────────────────────────────────────
  capas = signal<Capas>(this.leerCapas());

  recorridosEnMapa = computed(() => {
    const c = this.capas();
    if (!c.recorridos) return [];
    return c.soloImportantes ? this.estrellas() : this.recorridos();
  });

  zonaActual = computed(() => {
    const p = this.posicion();
    if (!p) return null;
    return this.zonas().find(
      (z) => z.radiusMeters && L.latLng(p.lat, p.lng).distanceTo([z.lat, z.lng]) <= z.radiusMeters
    ) ?? null;
  });

  ngOnInit(): void {
    this.recorridosService.cargar();

    this.zoneService.getByUser(0).subscribe({
      next: (zonas) => this.zonas.set(zonas),
      error: () => this.zonas.set([]),
    });

    this.authService.currentUser$.subscribe((user: any) => {
      if (!user) return;
      this.frequentPlaceService.getByUser(user.id).subscribe({
        next: (lugares) => this.ubicaciones.set(lugares.filter((l) => l.isActive !== false)),
        error: () => this.ubicaciones.set([]),
      });
      this.cargarHistorial(user.id);
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.iniciarGps();

    effect(() => this.dibujarYo(), { injector: this.injector });
    effect(() => this.dibujarRecorridos(), { injector: this.injector });
    effect(() => this.dibujarUbicaciones(), { injector: this.injector });
    effect(() => this.dibujarZonas(), { injector: this.injector });
    effect(() => this.dibujarCelular(), { injector: this.injector });
  }

  ngOnDestroy(): void {
    if (this.watchId !== null) navigator.geolocation?.clearWatch(this.watchId);
    this.resizeObserver?.disconnect();
    this.map?.remove();
    this.map = null;
  }

  // ── Capas ──────────────────────────────────────
  toggleCapa(capa: keyof Capas): void {
    this.capas.update((c) => {
      const nuevo = { ...c, [capa]: !c[capa] };
      // "Solo importantes" depende de que los recorridos estén visibles
      if (capa === 'recorridos' && !nuevo.recorridos) nuevo.soloImportantes = false;
      return nuevo;
    });
    try {
      localStorage.setItem(CAPAS_KEY, JSON.stringify(this.capas()));
    } catch { /* preferencia opcional */ }
  }

  private leerCapas(): Capas {
    try {
      return { ...CAPAS_DEFECTO, ...JSON.parse(localStorage.getItem(CAPAS_KEY) ?? '{}') };
    } catch {
      return { ...CAPAS_DEFECTO };
    }
  }

  // ── GPS en vivo ────────────────────────────────
  private iniciarGps(): void {
    if (!('geolocation' in navigator)) {
      this.estadoGps.set('no-disponible');
      return;
    }
    this.estadoGps.set('buscando');
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.posicion.set({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy });
        this.actualizadoEn.set(new Date(pos.timestamp));
        this.estadoGps.set('activo');
        this.actualizarLugar(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => this.estadoGps.set(err.code === err.PERMISSION_DENIED ? 'denegado' : 'no-disponible'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
  }

  private actualizarLugar(lat: number, lng: number): void {
    const aqui = L.latLng(lat, lng);
    if (this.ultimoGeocodificado && this.ultimoGeocodificado.distanceTo(aqui) < METROS_PARA_REGEOCODIFICAR) return;
    this.ultimoGeocodificado = aqui;
    this.buscandoLugar.set(true);
    this.geocoding.obtener(lat, lng).then((lugar) => {
      this.lugar.set(lugar);
      this.buscandoLugar.set(false);
    });
  }

  // ── Ubicación del celular ──────────────────────
  /** Trae la última ubicación que envió la app móvil y la muestra en el mapa. */
  verCelular(): void {
    this.cargandoCelular.set(true);
    this.errorCelular.set(false);
    this.phoneLocationService.getLatest().subscribe({
      next: (loc) => {
        this.cargandoCelular.set(false);
        this.celularConsultado.set(true);
        this.celular.set(loc);
        if (!loc) return;
        this.setTab('mapa');
        this.seguir.set(false);
        setTimeout(() => this.map?.flyTo([loc.lat, loc.lng], 17, { duration: 0.9 }), 150);
        this.lugarCelular.set(null);
        this.geocoding.obtener(loc.lat, loc.lng).then((lugar) => {
          if (this.celular()?.id === loc.id) this.lugarCelular.set(lugar);
        });
      },
      error: () => {
        this.cargandoCelular.set(false);
        this.errorCelular.set(true);
      },
    });
  }

  /** "hace 3 min", "hace 2 h"... */
  haceCuanto(iso?: string): string {
    if (!iso) return '';
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'hace un momento';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  }

  textoLugar(l: Lugar | null): string {
    return l ? [[l.direccion, l.ciudad].filter(Boolean).join(', '), l.barrio].filter(Boolean).join(' · ') : '';
  }

  reintentarGps(): void {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.iniciarGps();
  }

  centrar(): void {
    const p = this.posicion();
    this.seguir.set(true);
    if (p) this.map?.flyTo([p.lat, p.lng], 16, { duration: 0.8 });
  }

  // ── Mapa ───────────────────────────────────────
  private initMap(): void {
    if (!this.mapContainer || this.map) return;
    this.map = L.map(this.mapContainer.nativeElement, { center: CENTRO_POR_DEFECTO, zoom: 14 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    // Orden de abajo hacia arriba: zonas, recorridos, ubicaciones, yo
    [this.capaZonas, this.capaRecorridos, this.capaUbicaciones, this.capaCelular, this.capaYo].forEach((c) => c.addTo(this.map!));

    // Si la usuaria mueve el mapa, deja de seguirla hasta que pulse "Centrar"
    this.map.on('dragstart', () => this.seguir.set(false));
    // Recalcula el tamaño cuando cambia el ancho (sidebar, ventana, pestañas)
    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }

  private dibujarYo(): void {
    const p = this.posicion();
    if (!this.map) return;
    this.capaYo.clearLayers();
    if (!p) return;

    L.circle([p.lat, p.lng], {
      radius: p.precision, color: '#6366f1', weight: 1, fillColor: '#6366f1', fillOpacity: 0.12,
    }).addTo(this.capaYo);
    L.marker([p.lat, p.lng], { icon: youIcon, zIndexOffset: 1000 })
      .bindTooltip('Estás aquí')
      .addTo(this.capaYo);

    if (!this.centradoInicial) {
      this.map.setView([p.lat, p.lng], 16);
      this.centradoInicial = true;
    } else if (this.seguir()) {
      this.map.panTo([p.lat, p.lng], { animate: true });
    }
  }

  private dibujarCelular(): void {
    const loc = this.celular();
    const lugar = this.lugarCelular();
    if (!this.map) return;
    this.capaCelular.clearLayers();
    if (!loc) return;

    if (loc.accuracy) {
      L.circle([loc.lat, loc.lng], {
        radius: loc.accuracy, color: '#ec4899', weight: 1, fillColor: '#ec4899', fillOpacity: 0.12,
      }).addTo(this.capaCelular);
    }
    const detalle = lugar ? escapeHtml(this.textoLugar(lugar)) : 'Buscando dirección…';
    L.marker([loc.lat, loc.lng], { icon: phoneIcon, zIndexOffset: 900 })
      .bindPopup(`<strong>Tu celular</strong><br>${detalle}<br><small>${this.haceCuanto(loc.recordedAt)} · ${loc.time}</small>`)
      .addTo(this.capaCelular)
      .openPopup();
  }

  private dibujarRecorridos(): void {
    const lista = this.recorridosEnMapa();
    const todos = this.recorridos();
    if (!this.map) return;
    this.capaRecorridos.clearLayers();

    for (const r of lista) {
      if (!r.puntos || r.puntos.length < 2) continue;
      const latlngs = r.puntos.map((p) => [p.latitude, p.longitude] as L.LatLngTuple);
      const color = COLORES_RECORRIDO[Math.max(0, todos.findIndex((x) => x.id === r.id)) % COLORES_RECORRIDO.length];
      const nombre = escapeHtml(r.nombrePersonalizado ?? 'Recorrido');

      L.polyline(latlngs, { color, weight: r.importante ? 5 : 4, opacity: 0.95, dashArray: r.importante ? undefined : '8 8' })
        .bindTooltip(`${r.importante ? '★ ' : ''}${nombre}`, { sticky: true })
        .addTo(this.capaRecorridos);
      L.circleMarker(latlngs[0], { radius: 6, color: '#fff', weight: 2, fillColor: '#22c55e', fillOpacity: 1 })
        .bindPopup(`<strong>${nombre}</strong><br>Inicio: ${escapeHtml(r.barrioInicio)}`)
        .addTo(this.capaRecorridos);
      L.circleMarker(latlngs[latlngs.length - 1], { radius: 6, color: '#fff', weight: 2, fillColor: '#ef4444', fillOpacity: 1 })
        .bindPopup(`<strong>${nombre}</strong><br>Destino: ${escapeHtml(r.barrioFin)}`)
        .addTo(this.capaRecorridos);
    }
  }

  private dibujarUbicaciones(): void {
    const visibles = this.capas().ubicaciones;
    const lugares = this.ubicaciones();
    if (!this.map) return;
    this.capaUbicaciones.clearLayers();
    if (!visibles) return;

    for (const l of lugares) {
      if (!Number.isFinite(l.lat) || !Number.isFinite(l.lng)) continue;
      const riesgo = RIESGO_LUGAR[l.riskLevel ?? 'moderada'] ?? RIESGO_LUGAR['moderada'];
      L.marker([l.lat, l.lng], { icon: iconoLugar(riesgo.color) })
        .bindPopup(
          `<strong>${escapeHtml(l.name)}</strong><br>${escapeHtml(l.address || l.city || '')}<br>` +
          `<span style="color:${riesgo.color};font-weight:700">● ${riesgo.etiqueta}</span>`
        )
        .addTo(this.capaUbicaciones);
    }
  }

  private dibujarZonas(): void {
    const visibles = this.capas().zonas;
    const zonas = this.zonas();
    if (!this.map) return;
    this.capaZonas.clearLayers();
    if (!visibles) return;

    for (const z of zonas) {
      if (!Number.isFinite(z.lat) || !Number.isFinite(z.lng)) continue;
      const estilo = ZONA_ESTILO[z.type] ?? ZONA_ESTILO.risk;
      if (z.radiusMeters) {
        L.circle([z.lat, z.lng], {
          radius: z.radiusMeters, color: estilo.color, weight: 1.5, fillColor: estilo.color, fillOpacity: 0.12,
        }).addTo(this.capaZonas);
      }
      L.circleMarker([z.lat, z.lng], { radius: 5, color: '#fff', weight: 1.5, fillColor: estilo.color, fillOpacity: 1 })
        .bindPopup(`<strong>${escapeHtml(z.name)}</strong><br>${estilo.etiqueta}${z.city ? ' · ' + escapeHtml(z.city) : ''}`)
        .addTo(this.capaZonas);
    }
  }

  // ── Historial ──────────────────────────────────
  // Dirección de los registros más recientes, uno por uno (respeta el límite de Nominatim)
  private async geocodificarHistorial(entradas: UbicacionEntry[]): Promise<void> {
    for (const e of entradas) {
      const lugar = await this.geocoding.obtener(e.lat, e.lng);
      const texto = this.textoLugar(lugar);
      if (texto) this.lugaresHistorial.update((m) => ({ ...m, [e.id]: texto }));
    }
  }

  private cargarHistorial(_userId: number): void {
    this.cargandoHistorial.set(true);
    this.phoneLocationService.getMine(100).subscribe({
      next: (data) => {
        this.historial.set(data); // el backend ya las devuelve de la más reciente a la más antigua
        this.cargandoHistorial.set(false);
        this.geocodificarHistorial(data.slice(0, 20));
      },
      error: () => {
        this.errorHistorial.set(true);
        this.cargandoHistorial.set(false);
      },
    });
  }

  setTab(tab: SubTab): void {
    this.activeTab.set(tab);
    if (tab === 'mapa') setTimeout(() => this.map?.invalidateSize(), 100);
  }

  flyTo(loc: UbicacionEntry): void {
    this.seguir.set(false);
    this.setTab('mapa');
    setTimeout(() => this.map?.flyTo([loc.lat, loc.lng], 17, { duration: 1 }), 150);
  }

  horaActualizacion(): string {
    const d = this.actualizadoEn();
    return d ? d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
  }
}

function iconoLugar(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="mu-place-pin" style="--pin:${color}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });
}

function escapeHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
