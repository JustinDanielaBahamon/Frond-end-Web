import {
  AfterViewInit, Component, ElementRef, Injector, OnDestroy, OnInit, ViewChild,
  WritableSignal, computed, effect, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { RecorridosService, Recorrido } from '../../../core/services/recorridos.service';
import { FrequentPlaceService } from '../../../core/services/frequent-places.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FrequentPlace } from '../../../core/models/frequent-place.model';

type PuntoSeleccionado = {
  latitude: number;
  longitude: number;
  nombre?: string;
};

type MetodoSeleccion = 'mapa' | 'ubicaciones';
type SubTab = 'recorridos' | 'historial';
type FiltroVisibilidad = 'todos' | 'estrellas' | 'ocultar';

// Neiva (Huila): mismo centro por defecto que la app móvil
const CENTRO_POR_DEFECTO: L.LatLngTuple = [2.9273, -75.2819];
// Velocidad a pie usada por el móvil para estimar el tiempo
const VELOCIDAD_KMH = 5;
// Un color por recorrido (máximo 4)
const COLORES = ['#a78bfa', '#38bdf8', '#f472b6', '#34d399'];

@Component({
  selector: 'app-guardar-recorrido',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './guardar-recorrido.html',
  styleUrl: './guardar-recorrido.scss',
})
export class GuardarRecorridoComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  private recorridosService = inject(RecorridosService);
  private frequentPlaceService = inject(FrequentPlaceService);
  private authService = inject(AuthService);
  private injector = inject(Injector);

  private map: L.Map | null = null;
  private resizeObserver?: ResizeObserver;
  private capaRecorridos = L.layerGroup();
  private capaSeleccion = L.layerGroup();
  private capaLugares = L.layerGroup();
  private vistaAjustada = false;

  readonly MAX_RECORRIDOS = this.recorridosService.limiteRecorridos;
  readonly MAX_ESTRELLAS = this.recorridosService.limiteEstrellas;

  // ── Estado general ─────────────────────────────
  activeTab = signal<SubTab>('recorridos');
  cargando = this.recorridosService.cargando;
  guardando = signal(false);
  error = signal('');
  aviso = signal('');
  exito = signal('');

  recorridos = this.recorridosService.recorridos$;
  estrellas = computed(() => this.recorridos().filter((r) => r.importante));
  limiteAlcanzado = computed(() => this.recorridos().length >= this.MAX_RECORRIDOS);

  filtroVisibilidad = signal<FiltroVisibilidad>('todos');
  recorridosEnMapa = computed(() => {
    switch (this.filtroVisibilidad()) {
      case 'ocultar': return [];
      case 'estrellas': return this.estrellas();
      default: return this.recorridos();
    }
  });

  seleccionado = signal<Recorrido | null>(null);
  detalle = signal<Recorrido | null>(null);

  // ── Formulario de nuevo recorrido ──────────────
  readonly puntosForm = ['A', 'B'] as const;
  metodoSeleccion = signal<MetodoSeleccion>('mapa');
  puntoSeleccionando = signal<'A' | 'B' | null>(null);
  puntoA = signal<PuntoSeleccionado | null>(null);
  puntoB = signal<PuntoSeleccionado | null>(null);
  nombrePuntoA = signal('');
  nombrePuntoB = signal('');
  nombreRecorrido = signal('');
  ubicacionesGuardadas = signal<FrequentPlace[]>([]);

  distanciaKm = computed(() => {
    const a = this.puntoA();
    const b = this.puntoB();
    return a && b ? haversineKm(a, b) : null;
  });

  minutosEstimados = computed(() => {
    const km = this.distanciaKm();
    return km == null ? null : Math.round((km / VELOCIDAD_KMH) * 60);
  });

  puedeGuardar = computed(
    () => !!this.puntoA() && !!this.puntoB() && !this.limiteAlcanzado() && !this.guardando()
  );

  ngOnInit(): void {
    this.recorridosService.cargar().then((r) => {
      if (!r.ok) this.error.set(r.error ?? '');
    });

    this.authService.currentUser$.subscribe((user: any) => {
      if (!user) return;
      this.frequentPlaceService.getByUser(user.id).subscribe({
        next: (lugares) => this.ubicacionesGuardadas.set(lugares),
        error: () => this.ubicacionesGuardadas.set([]),
      });
    });
  }

  ngAfterViewInit(): void {
    this.initMap();

    // Redibuja el mapa cuando cambian los recorridos, el filtro, la selección o los lugares
    effect(() => this.dibujarRecorridos(), { injector: this.injector });
    effect(() => this.dibujarSeleccion(), { injector: this.injector });
    effect(() => this.dibujarLugares(), { injector: this.injector });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
    this.map = null;
  }

  // ── Mapa ───────────────────────────────────────
  private initMap(): void {
    if (!this.mapContainer || this.map) return;

    this.map = L.map(this.mapContainer.nativeElement, { center: CENTRO_POR_DEFECTO, zoom: 13 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    this.capaLugares.addTo(this.map);
    this.capaRecorridos.addTo(this.map);
    this.capaSeleccion.addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const punto = this.puntoSeleccionando();
      if (!punto) return;
      this.fijarPunto(punto, { latitude: e.latlng.lat, longitude: e.latlng.lng });
    });

    // El contenedor puede cambiar de tamaño al montar la vista
    // Recalcula el tamaño cuando cambia el ancho (sidebar, ventana, pestañas)
    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }

  private dibujarRecorridos(): void {
    const lista = this.recorridosEnMapa();
    const seleccionado = this.seleccionado();
    const todos = this.recorridos();
    if (!this.map) return;

    this.capaRecorridos.clearLayers();
    const bounds = L.latLngBounds([]);

    for (const r of lista) {
      if (!r.puntos || r.puntos.length < 2) continue;
      const latlngs = r.puntos.map((p) => [p.latitude, p.longitude] as L.LatLngTuple);
      const color = this.colorDe(r, todos);
      const activo = seleccionado?.id === r.id;

      L.polyline(latlngs, {
        color,
        weight: activo ? 7 : r.importante ? 5 : 4,
        opacity: seleccionado && !activo ? 0.45 : 0.95,
        dashArray: r.importante ? undefined : '8 8',
      })
        .bindTooltip(`${r.importante ? '★ ' : ''}${escapeHtml(r.nombrePersonalizado ?? 'Recorrido')}`, { sticky: true })
        .on('click', () => this.enfocar(r))
        .addTo(this.capaRecorridos);

      L.marker(latlngs[0], { icon: iconoPunto('A', color) })
        .bindPopup(`<strong>${escapeHtml(r.nombrePersonalizado ?? 'Recorrido')}</strong><br>Inicio: ${escapeHtml(r.barrioInicio)}`)
        .addTo(this.capaRecorridos);
      L.marker(latlngs[latlngs.length - 1], { icon: iconoPunto('B', color) })
        .bindPopup(`<strong>${escapeHtml(r.nombrePersonalizado ?? 'Recorrido')}</strong><br>Fin: ${escapeHtml(r.barrioFin)}`)
        .addTo(this.capaRecorridos);

      latlngs.forEach((ll) => bounds.extend(ll));
    }

    // Encuadra los recorridos la primera vez que hay datos
    if (!this.vistaAjustada && bounds.isValid() && !this.puntoA() && !this.puntoB()) {
      this.map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
      this.vistaAjustada = true;
    }
  }

  private dibujarSeleccion(): void {
    const a = this.puntoA();
    const b = this.puntoB();
    if (!this.map) return;

    this.capaSeleccion.clearLayers();
    if (a) L.marker([a.latitude, a.longitude], { icon: iconoPunto('A', '#22c55e', true) }).addTo(this.capaSeleccion);
    if (b) L.marker([b.latitude, b.longitude], { icon: iconoPunto('B', '#ef4444', true) }).addTo(this.capaSeleccion);
    if (a && b) {
      L.polyline([[a.latitude, a.longitude], [b.latitude, b.longitude]], {
        color: '#f5f3ff', weight: 4, opacity: 0.95, dashArray: '2 8', lineCap: 'round',
      }).addTo(this.capaSeleccion);
      this.map.fitBounds(
        [[a.latitude, a.longitude], [b.latitude, b.longitude]],
        { padding: [64, 64], maxZoom: 16 }
      );
    }
  }

  private dibujarLugares(): void {
    const lugares = this.ubicacionesGuardadas();
    if (!this.map) return;

    this.capaLugares.clearLayers();
    for (const lugar of lugares) {
      if (!Number.isFinite(lugar.lat) || !Number.isFinite(lugar.lng)) continue;
      L.circleMarker([lugar.lat, lugar.lng], {
        radius: 6, color: '#ffffff', weight: 2, fillColor: '#7c3aed', fillOpacity: 1,
      })
        .bindTooltip(escapeHtml(lugar.name))
        .on('click', (e: L.LeafletMouseEvent) => {
          // Si se está eligiendo un punto, el lugar guardado lo fija con su nombre
          const punto = this.puntoSeleccionando();
          if (!punto) return;
          L.DomEvent.stopPropagation(e);
          this.seleccionarUbicacion(lugar);
        })
        .addTo(this.capaLugares);
    }
  }

  colorDe(r: Recorrido, lista = this.recorridos()): string {
    const i = lista.findIndex((x) => x.id === r.id);
    return COLORES[(i < 0 ? 0 : i) % COLORES.length];
  }

  // ── Selección de puntos ────────────────────────
  setMetodo(metodo: MetodoSeleccion): void {
    this.metodoSeleccion.set(metodo);
    this.puntoSeleccionando.set(null);
  }

  elegirPunto(punto: 'A' | 'B'): void {
    this.error.set('');
    this.puntoSeleccionando.set(this.puntoSeleccionando() === punto ? null : punto);
  }

  seleccionarUbicacion(lugar: FrequentPlace): void {
    const punto = this.puntoSeleccionando();
    if (!punto) return;
    this.fijarPunto(punto, { latitude: lugar.lat, longitude: lugar.lng, nombre: lugar.name });
  }

  usarMiUbicacion(punto: 'A' | 'B'): void {
    if (!navigator.geolocation) {
      this.error.set('Tu navegador no permite obtener la ubicación.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => this.fijarPunto(punto, {
        latitude: pos.coords.latitude, longitude: pos.coords.longitude, nombre: 'Mi ubicación',
      }),
      () => this.error.set('No se pudo obtener tu ubicación. Revisa los permisos del navegador.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  private fijarPunto(punto: 'A' | 'B', valor: PuntoSeleccionado): void {
    if (punto === 'A') {
      this.puntoA.set(valor);
      if (valor.nombre) this.nombrePuntoA.set(valor.nombre);
    } else {
      this.puntoB.set(valor);
      if (valor.nombre) this.nombrePuntoB.set(valor.nombre);
    }
    // Tras fijar A, pasa directo a elegir B
    this.puntoSeleccionando.set(punto === 'A' && !this.puntoB() ? 'B' : null);
  }

  limpiarSeleccion(): void {
    this.puntoA.set(null);
    this.puntoB.set(null);
    this.nombrePuntoA.set('');
    this.nombrePuntoB.set('');
    this.nombreRecorrido.set('');
    this.puntoSeleccionando.set(null);
    this.error.set('');
  }

  // ── Acciones sobre recorridos ──────────────────
  async guardarRecorrido(): Promise<void> {
    const a = this.puntoA();
    const b = this.puntoB();
    if (!a || !b || this.guardando()) return;

    const inicio = this.nombrePuntoA().trim() || a.nombre || 'Punto A';
    const fin = this.nombrePuntoB().trim() || b.nombre || 'Punto B';

    this.guardando.set(true);
    const resultado = await this.recorridosService.agregarRecorrido({
      nombre: this.nombreRecorrido().trim() || `Ruta ${inicio} → ${fin}`,
      inicio,
      fin,
      puntos: [
        { latitude: a.latitude, longitude: a.longitude, timestamp: '' },
        { latitude: b.latitude, longitude: b.longitude, timestamp: '' },
      ],
      distanciaKm: this.distanciaKm() ?? 0,
      minutosEstimados: this.minutosEstimados() ?? 0,
    });
    this.guardando.set(false);

    if (!resultado.ok) {
      this.error.set(resultado.error ?? 'No se pudo guardar el recorrido.');
      return;
    }
    this.limpiarSeleccion();
    this.vistaAjustada = false;
    this.mostrar(this.exito, 'Recorrido guardado. Ya aparece también en la app móvil.');
  }

  async toggleEstrella(r: Recorrido, event?: Event): Promise<void> {
    event?.stopPropagation();
    const resultado = await this.recorridosService.toggleImportante(r.id);
    if (!resultado.ok) this.mostrar(this.aviso, resultado.error ?? '');
    this.sincronizarSeleccion();
  }

  async eliminar(r: Recorrido, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!confirm(`¿Eliminar el recorrido "${r.nombrePersonalizado ?? 'sin nombre'}"? También se borrará de la app móvil.`)) {
      return;
    }
    const resultado = await this.recorridosService.eliminarRecorrido(r.id);
    if (!resultado.ok) {
      this.mostrar(this.aviso, resultado.error ?? '');
      return;
    }
    if (this.seleccionado()?.id === r.id) this.seleccionado.set(null);
    if (this.detalle()?.id === r.id) this.detalle.set(null);
  }

  setVisibilidad(filtro: FiltroVisibilidad): void {
    this.filtroVisibilidad.set(filtro);
    if (filtro === 'ocultar') this.seleccionado.set(null);
  }

  enfocar(r: Recorrido): void {
    this.seleccionado.set(this.seleccionado()?.id === r.id ? null : r);
    if (!this.seleccionado() || !this.map || r.puntos.length < 2) return;

    // Si el filtro lo esconde, mostrarlo
    if (this.filtroVisibilidad() === 'ocultar' || (this.filtroVisibilidad() === 'estrellas' && !r.importante)) {
      this.filtroVisibilidad.set('todos');
    }
    this.map.flyToBounds(
      L.latLngBounds(r.puntos.map((p) => [p.latitude, p.longitude] as L.LatLngTuple)),
      { padding: [64, 64], maxZoom: 16, duration: 0.8 }
    );
  }

  verDetalle(r: Recorrido): void {
    this.detalle.set(r);
    this.enfocar(r);
    if (this.seleccionado()?.id !== r.id) this.seleccionado.set(r);
  }

  cerrarDetalle(): void {
    this.detalle.set(null);
  }

  setTab(tab: SubTab): void {
    this.activeTab.set(tab);
    this.puntoSeleccionando.set(null);
  }

  formatearFecha(fecha: string): string {
    const d = new Date(fecha);
    return isNaN(d.getTime())
      ? fecha
      : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatearMinutos(min: number | null): string {
    if (min == null) return '—';
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}min`;
  }

  coordenadas(p: PuntoSeleccionado): string {
    return `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`;
  }

  // Mantiene los objetos seleccionados apuntando a la versión actualizada del recorrido
  private sincronizarSeleccion(): void {
    const buscar = (r: Recorrido | null) => (r ? this.recorridos().find((x) => x.id === r.id) ?? null : null);
    this.seleccionado.set(buscar(this.seleccionado()));
    this.detalle.set(buscar(this.detalle()));
  }

  private mostrar(senal: WritableSignal<string>, mensaje: string): void {
    senal.set(mensaje);
    setTimeout(() => {
      if (senal() === mensaje) senal.set('');
    }, 4000);
  }
}

function haversineKm(a: PuntoSeleccionado, b: PuntoSeleccionado): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function iconoPunto(letra: string, color: string, grande = false): L.DivIcon {
  const size = grande ? 34 : 26;
  return L.divIcon({
    className: 'gr-pin',
    html: `<span class="gr-pin__dot${grande ? ' gr-pin__dot--lg' : ''}" style="background:${color}">${letra}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function escapeHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
