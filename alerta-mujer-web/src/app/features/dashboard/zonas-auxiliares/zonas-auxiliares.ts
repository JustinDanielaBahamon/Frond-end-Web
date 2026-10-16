import {
  AfterViewInit, Component, ElementRef, Injector, OnDestroy, OnInit, ViewChild,
  computed, effect, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, catchError } from 'rxjs';
import * as L from 'leaflet';
import { NearbyZoneService } from '../../../core/services/nearby-zone.service';
import { ResourcesService } from '../../../core/services/resources.service';
import { NearbyZone } from '../../../core/models/nearby-zone.model';
import { EmergencyResourceApi } from '../../../core/models/resource.model';

type Categoria = 'riesgo' | 'segura' | 'policia' | 'salud' | 'apoyo' | 'linea';

/** Zona o recurso de emergencia, unificados para la lista y el mapa. */
interface Punto {
  clave: string;
  origen: 'zona' | 'recurso';
  nombre: string;
  categoria: Categoria;
  descripcion?: string;
  direccion?: string;
  ciudad?: string;
  lat?: number;
  lng?: number;
  radio?: number;
  telefono?: string;
  telefono2?: string;
}

// Colores alineados con "Mi ubicación" y la app móvil
export const CATEGORIAS: Record<Categoria, { etiqueta: string; color: string }> = {
  riesgo: { etiqueta: 'Zona de riesgo', color: '#cb1ce6' },
  segura: { etiqueta: 'Zona segura', color: '#5316a3' },
  policia: { etiqueta: 'Policía', color: '#9333ea' },
  salud: { etiqueta: 'Salud', color: '#733bf6' },
  apoyo: { etiqueta: 'Apoyo a la mujer', color: '#d648ec' },
  linea: { etiqueta: 'Línea de ayuda', color: '#a70bf5' },
};

const CENTRO_POR_DEFECTO: L.LatLngTuple = [2.9273, -75.2819];

function categoriaZona(tipo: NearbyZone['type']): Categoria {
  switch (tipo) {
    case 'safe': return 'segura';
    case 'policia': return 'policia';
    case 'asistencia':
    case 'help': return 'apoyo';
    default: return 'riesgo';
  }
}

function categoriaRecurso(tipo: string): Categoria {
  switch (tipo) {
    case 'police_station':
    case 'police_post': return 'policia';
    case 'hospital':
    case 'health_center':
    case 'ambulance': return 'salud';
    case 'emergency_line': return 'linea';
    default: return 'apoyo'; // support_organization, fire_station
  }
}

@Component({
  selector: 'app-zonas-auxiliares',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './zonas-auxiliares.html',
  styleUrl: './zonas-auxiliares.scss',
})
export class ZonasAuxiliaresComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  private zoneService = inject(NearbyZoneService);
  private resourcesService = inject(ResourcesService);
  private injector = inject(Injector);

  private map: L.Map | null = null;
  private resizeObserver?: ResizeObserver;
  private capaPuntos = L.layerGroup();
  private capaYo = L.layerGroup();
  private marcadores = new Map<string, L.Layer>();
  private vistaAjustada = false;

  readonly categorias = CATEGORIAS;
  readonly listaCategorias = Object.keys(CATEGORIAS) as Categoria[];

  puntos = signal<Punto[]>([]);
  cargando = signal(true);
  error = signal('');

  busqueda = signal('');
  filtro = signal<Categoria | null>(null);
  seleccionado = signal<string | null>(null);

  miPosicion = signal<{ lat: number; lng: number } | null>(null);
  estadoUbicacion = signal<'sin-pedir' | 'buscando' | 'ok' | 'denegada'>('sin-pedir');

  /** Líneas para llamar sin buscar (se muestran siempre arriba). */
  lineas = computed(() => this.puntos().filter((p) => p.categoria === 'linea' && p.telefono));

  conteo = computed(() => {
    const c = Object.fromEntries(this.listaCategorias.map((k) => [k, 0])) as Record<Categoria, number>;
    for (const p of this.puntos()) c[p.categoria]++;
    return c;
  });

  /** Lista filtrada y ordenada por cercanía (si se conoce la ubicación). */
  filtrados = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const filtro = this.filtro();
    const lista = this.puntos().filter((p) => {
      if (filtro && p.categoria !== filtro) return false;
      if (!termino) return true;
      return [p.nombre, p.direccion, p.ciudad, p.descripcion, CATEGORIAS[p.categoria].etiqueta]
        .some((t) => (t ?? '').toLowerCase().includes(termino));
    });
    if (!this.miPosicion()) return lista;
    return [...lista].sort((a, b) => (this.distancia(a) ?? Infinity) - (this.distancia(b) ?? Infinity));
  });

  /** Zonas de riesgo / seguras en las que la usuaria está ahora mismo. */
  zonasActuales = computed(() =>
    this.puntos().filter((p) => p.radio && (this.distancia(p) ?? Infinity) <= p.radio)
  );

  ngOnInit(): void {
    forkJoin({
      zonas: this.zoneService.getByUser(0).pipe(catchError(() => of(null))),
      recursos: this.resourcesService.getActiveResources().pipe(catchError(() => of(null))),
    }).subscribe(({ zonas, recursos }) => {
      if (!zonas && !recursos) this.error.set('No se pudieron cargar las zonas. Intenta de nuevo.');
      this.puntos.set([...(zonas ?? []).map(desdeZona), ...(recursos ?? []).map(desdeRecurso)]);
      this.cargando.set(false);
    });

    // Si ya dio permiso de ubicación antes, se usa sin volver a preguntar
    navigator.permissions?.query({ name: 'geolocation' as PermissionName })
      .then((p) => { if (p.state === 'granted') this.usarMiUbicacion(); })
      .catch(() => {});
  }

  ngAfterViewInit(): void {
    this.initMap();
    effect(() => this.dibujarPuntos(), { injector: this.injector });
    effect(() => this.dibujarYo(), { injector: this.injector });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
    this.map = null;
  }

  // ── Ubicación de la usuaria ────────────────────
  usarMiUbicacion(): void {
    if (!navigator.geolocation) {
      this.estadoUbicacion.set('denegada');
      return;
    }
    this.estadoUbicacion.set('buscando');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.miPosicion.set({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        this.estadoUbicacion.set('ok');
      },
      () => this.estadoUbicacion.set('denegada'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  distancia(p: Punto): number | null {
    const yo = this.miPosicion();
    if (!yo || p.lat == null || p.lng == null) return null;
    return L.latLng(yo.lat, yo.lng).distanceTo([p.lat, p.lng]);
  }

  formatoDistancia(p: Punto): string {
    const d = this.distancia(p);
    if (d == null) return '';
    return d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(d < 10000 ? 1 : 0)} km`;
  }

  // ── Mapa ───────────────────────────────────────
  private initMap(): void {
    if (!this.mapContainer || this.map) return;
    this.map = L.map(this.mapContainer.nativeElement, { center: CENTRO_POR_DEFECTO, zoom: 13 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);
    this.capaPuntos.addTo(this.map);
    this.capaYo.addTo(this.map);

    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }

  private dibujarPuntos(): void {
    const lista = this.filtrados();
    const seleccionado = this.seleccionado();
    if (!this.map) return;

    this.capaPuntos.clearLayers();
    this.marcadores.clear();
    const bounds = L.latLngBounds([]);

    for (const p of lista) {
      if (p.lat == null || p.lng == null) continue;
      const { color } = CATEGORIAS[p.categoria];
      const activo = p.clave === seleccionado;

      if (p.radio) {
        L.circle([p.lat, p.lng], {
          radius: p.radio, color, weight: activo ? 3 : 1.5, fillColor: color, fillOpacity: activo ? 0.22 : 0.12,
        }).on('click', () => this.seleccionado.set(p.clave)).addTo(this.capaPuntos);
      }
      const marcador = L.marker([p.lat, p.lng], { icon: iconoPunto(p.categoria, activo), zIndexOffset: activo ? 500 : 0 })
        .bindPopup(popupPunto(p, this.formatoDistancia(p)))
        .on('click', () => this.seleccionado.set(p.clave))
        .addTo(this.capaPuntos);
      this.marcadores.set(p.clave, marcador);
      bounds.extend([p.lat, p.lng]);
    }

    if (!this.vistaAjustada && bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
      this.vistaAjustada = true;
    }
  }

  private dibujarYo(): void {
    const yo = this.miPosicion();
    if (!this.map) return;
    this.capaYo.clearLayers();
    if (!yo) return;
    L.marker([yo.lat, yo.lng], {
      icon: L.divIcon({ className: '', html: '<div class="za-you"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
      zIndexOffset: 1000,
    }).bindTooltip('Estás aquí').addTo(this.capaYo);
  }

  verEnMapa(p: Punto): void {
    this.seleccionado.set(p.clave);
    if (p.lat == null || p.lng == null || !this.map) return;
    this.map.flyTo([p.lat, p.lng], p.radio && p.radio > 300 ? 15 : 16, { duration: 0.8 });
    setTimeout(() => (this.marcadores.get(p.clave) as L.Marker | undefined)?.openPopup(), 850);
  }

  centrarEnMi(): void {
    const yo = this.miPosicion();
    if (yo) this.map?.flyTo([yo.lat, yo.lng], 15, { duration: 0.8 });
  }

  telHref(tel: string): string {
    return `tel:${tel.replace(/[^\d+]/g, '')}`;
  }
}

function desdeZona(z: NearbyZone): Punto {
  return {
    clave: `z${z.id}`,
    origen: 'zona',
    nombre: z.name,
    categoria: categoriaZona(z.type),
    descripcion: z.description,
    direccion: z.address,
    ciudad: z.city,
    lat: z.lat,
    lng: z.lng,
    radio: z.radiusMeters,
  };
}

function desdeRecurso(r: EmergencyResourceApi): Punto {
  return {
    clave: `r${r.id}`,
    origen: 'recurso',
    nombre: r.name,
    categoria: categoriaRecurso(r.resourceType),
    descripcion: r.description ?? undefined,
    direccion: r.address ?? undefined,
    ciudad: r.city,
    lat: r.latitude ?? undefined,
    lng: r.longitude ?? undefined,
    telefono: r.telephone ?? undefined,
    telefono2: r.secondaryTelephone ?? undefined,
  };
}

const ICONOS: Record<Categoria, string> = {
  riesgo: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  segura: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  policia: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  salud: '<path d="M12 5v14M5 12h14"/>',
  apoyo: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  linea: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
};

export function iconoSvg(c: Categoria): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONOS[c]}</svg>`;
}

function iconoPunto(c: Categoria, activo: boolean): L.DivIcon {
  const size = activo ? 34 : 28;
  return L.divIcon({
    className: '',
    html: `<div class="za-pin${activo ? ' za-pin--active' : ''}" style="--pin:${CATEGORIAS[c].color}">${iconoSvg(c)}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function popupPunto(p: Punto, distancia: string): string {
  const { etiqueta, color } = CATEGORIAS[p.categoria];
  const lugar = [p.direccion, p.ciudad].filter(Boolean).join(', ');
  return `
    <div class="za-popup">
      <div class="za-popup-type" style="color:${color}">● ${etiqueta}</div>
      <div class="za-popup-name">${escapeHtml(p.nombre)}</div>
      ${lugar ? `<div class="za-popup-row">${escapeHtml(lugar)}</div>` : ''}
      ${p.descripcion ? `<div class="za-popup-row">${escapeHtml(p.descripcion)}</div>` : ''}
      ${distancia ? `<div class="za-popup-row"><strong>A ${distancia} de ti</strong></div>` : ''}
      ${p.telefono ? `<a class="za-popup-call" href="tel:${p.telefono.replace(/[^\d+]/g, '')}">Llamar ${escapeHtml(p.telefono)}</a>` : ''}
    </div>`;
}

function escapeHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
