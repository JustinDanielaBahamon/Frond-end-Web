import {
  AfterViewInit, Component, ElementRef, Injector, OnDestroy, OnInit, ViewChild,
  computed, effect, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { AssistanceService } from '../../../core/services/assistance.service';
import { NearbyZoneService } from '../../../core/services/nearby-zone.service';
import { PhoneLocationService } from '../../../core/services/phone.location.services';
import { NearbyZone } from '../../../core/models/nearby-zone.model';
import { iconoZona } from '../../../core/utils/icono-zona';
import { CategoriaRecurso, LlamadaRegistrada, RecursoAyuda } from '../../../core/models/assistance.model';

type Tab = 'lineas' | 'centros' | 'llamadas';

export const CATEGORIAS: Record<CategoriaRecurso, { etiqueta: string; color: string }> = {
  linea: { etiqueta: 'Línea de ayuda', color: '#8b5cf6' },
  policia: { etiqueta: 'Policía', color: '#7c3aed' },
  salud: { etiqueta: 'Salud', color: '#5b21b6' },
  apoyo: { etiqueta: 'Apoyo a la mujer', color: '#6d28d9' },
  bomberos: { etiqueta: 'Bomberos', color: '#c026d3' },
};

const ESTADOS: Record<string, string> = {
  initiated: 'Iniciada', completed: 'Completada', failed: 'Fallida', missed: 'Sin respuesta',
};

const NUMERO_EMERGENCIA = '123';
const CENTRO_POR_DEFECTO: L.LatLngTuple = [2.9273, -75.2819];

@Component({
  selector: 'app-assistance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assistance.html',
  styleUrl: './assistance.scss',
})
export class Assistance implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;

  private service = inject(AssistanceService);
  private zonasService = inject(NearbyZoneService);
  private ubicacionCelular = inject(PhoneLocationService);
  private injector = inject(Injector);

  private map: L.Map | null = null;
  private resizeObserver?: ResizeObserver;
  private capa = L.layerGroup();
  private marcadores = new Map<number, L.Marker>();
  private vistaAjustada = false;

  readonly categorias = CATEGORIAS;
  readonly listaCategorias = Object.keys(CATEGORIAS) as CategoriaRecurso[];
  readonly numeroEmergencia = NUMERO_EMERGENCIA;

  tab = signal<Tab>('lineas');
  recursos = signal<RecursoAyuda[]>([]);
  /** Zonas de auxilio del mapa del inicio (policía, centros de asistencia, puntos de ayuda). */
  zonasAuxilio = signal<RecursoAyuda[]>([]);
  /** Todo lo que se puede mostrar en el mapa de centros. */
  private puntos = computed(() => [...this.recursos(), ...this.zonasAuxilio()]);
  llamadas = signal<LlamadaRegistrada[]>([]);
  cargando = signal(true);
  error = signal('');
  aviso = signal('');

  busqueda = signal('');
  filtro = signal<CategoriaRecurso | null>(null);
  seleccionado = signal<number | null>(null);
  miPosicion = signal<{ lat: number; lng: number } | null>(null);

  /** Recursos a los que se puede llamar. */
  lineas = computed(() => this.recursos().filter((r) => r.telefono));

  /** Recursos con ubicación, filtrados y ordenados por cercanía si se conoce. */
  centros = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const filtro = this.filtro();
    const lista = this.puntos().filter((r) => {
      if (r.lat == null || r.lng == null) return false;
      if (filtro && r.categoria !== filtro) return false;
      if (!termino) return true;
      return [r.nombre, r.descripcion, r.direccion, r.ciudad, CATEGORIAS[r.categoria].etiqueta]
        .some((t) => (t ?? '').toLowerCase().includes(termino));
    });
    if (!this.miPosicion()) return lista;
    return [...lista].sort((a, b) => (this.distancia(a) ?? Infinity) - (this.distancia(b) ?? Infinity));
  });

  conteoCentros = computed(() => {
    const c = Object.fromEntries(this.listaCategorias.map((k) => [k, 0])) as Record<CategoriaRecurso, number>;
    for (const r of this.puntos()) if (r.lat != null && r.lng != null) c[r.categoria]++;
    return c;
  });

  totalCentros = computed(() => this.puntos().filter((r) => r.lat != null && r.lng != null).length);

  ngOnInit(): void {
    this.service.getRecursos().subscribe({
      next: (lista) => {
        this.recursos.set(lista);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los recursos de ayuda. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
    this.zonasService.getByUser(0).subscribe({
      next: (zonas) => this.zonasAuxilio.set(zonas.map(desdeZona).filter((z): z is RecursoAyuda => z !== null)),
      error: () => {},
    });
    this.cargarLlamadas();
    // La distancia se mide desde el celular (la ubicación que envía la app), no desde el computador
    this.usarMiUbicacion(false);
  }

  ngAfterViewInit(): void {
    effect(() => this.dibujar(), { injector: this.injector });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
    this.map = null;
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'centros') setTimeout(() => this.initMap(), 0);
  }

  // ── Llamadas ───────────────────────────────────
  private cargarLlamadas(): void {
    this.service.getMisLlamadas().subscribe({ next: (l) => this.llamadas.set(l), error: () => {} });
  }

  copiar(numero: string): void {
    navigator.clipboard?.writeText(numero).then(() => this.mostrarAviso(`Número ${numero} copiado.`));
  }

  eliminarLlamada(l: LlamadaRegistrada): void {
    this.service.eliminarLlamada(l.id).subscribe({
      next: () => this.llamadas.update((lista) => lista.filter((x) => x.id !== l.id)),
      error: () => this.mostrarAviso('No se pudo borrar el registro.'),
    });
  }

  recursoDe(l: LlamadaRegistrada): RecursoAyuda | undefined {
    return this.recursos().find((r) => r.id === l.recursoId);
  }

  // ── Centros y mapa ─────────────────────────────
  usarMiUbicacion(avisar = true): void {
    this.ubicacionCelular.getLatest().subscribe({
      next: (u) => {
        if (u) {
          this.miPosicion.set({ lat: u.lat, lng: u.lng });
          this.vistaAjustada = false;
        } else if (avisar) {
          this.mostrarAviso('Tu celular aún no ha enviado su ubicación. Abre AlertaMujer en el celular para ver distancias.');
        }
      },
      error: () => { if (avisar) this.mostrarAviso('No pudimos obtener la ubicación de tu celular.'); },
    });
  }

  distancia(r: RecursoAyuda): number | null {
    const yo = this.miPosicion();
    if (!yo || r.lat == null || r.lng == null) return null;
    return L.latLng(yo.lat, yo.lng).distanceTo([r.lat, r.lng]);
  }

  formatoDistancia(r: RecursoAyuda): string {
    const d = this.distancia(r);
    if (d == null) return '';
    return d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(d < 10000 ? 1 : 0)} km`;
  }

  comoLlegar(r: RecursoAyuda): string {
    const yo = this.miPosicion();
    return `https://www.openstreetmap.org/directions?route=${yo ? `${yo.lat},${yo.lng}` : ''};${r.lat},${r.lng}`;
  }

  verEnMapa(r: RecursoAyuda): void {
    this.seleccionado.set(r.id);
    if (r.lat == null || r.lng == null) return;
    this.map?.flyTo([r.lat, r.lng], 16, { duration: 0.8 });
    setTimeout(() => this.marcadores.get(r.id)?.openPopup(), 850);
  }

  private initMap(): void {
    if (this.map || !this.mapContainer) return;
    this.map = L.map(this.mapContainer.nativeElement, { center: CENTRO_POR_DEFECTO, zoom: 13 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);
    this.capa.addTo(this.map);
    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapContainer.nativeElement);
    this.dibujar();
  }

  private dibujar(): void {
    const lista = this.centros();
    const seleccionado = this.seleccionado();
    const yo = this.miPosicion();
    if (!this.map) return;

    this.capa.clearLayers();
    this.marcadores.clear();
    const bounds = L.latLngBounds([]);

    for (const r of lista) {
      const { color, etiqueta } = CATEGORIAS[r.categoria];
      const activo = r.id === seleccionado;
      const marcador = L.marker([r.lat!, r.lng!], {
        icon: iconoZona(r.categoria, color, activo),
        zIndexOffset: activo ? 500 : 0,
      })
        .bindPopup(`<strong>${escapeHtml(r.nombre)}</strong><br><span style="color:${color};font-weight:700">${etiqueta}</span>`
          + (r.direccion ? `<br>${escapeHtml(r.direccion)}` : '') + `<br>${escapeHtml(r.ciudad)}`)
        .on('click', () => this.seleccionado.set(r.id))
        .addTo(this.capa);
      this.marcadores.set(r.id, marcador);
    }
    // Con la ubicación del celular se encuadran los más cercanos (la lista ya viene ordenada);
    // sin ella, todos
    for (const r of yo ? lista.slice(0, 8) : lista) bounds.extend([r.lat!, r.lng!]);
    if (yo) bounds.extend([yo.lat, yo.lng]);

    if (yo) {
      L.marker([yo.lat, yo.lng], {
        icon: L.divIcon({ className: '', html: '<div class="as-you"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }),
        zIndexOffset: 1000,
      }).bindTooltip('Estás aquí').addTo(this.capa);
    }

    if (!this.vistaAjustada && bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      this.vistaAjustada = true;
    }
  }

  // ── Formato ────────────────────────────────────
  estado(e: string): string {
    return ESTADOS[e] ?? e;
  }

  fecha(d: Date): string {
    return d.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  }

  private mostrarAviso(texto: string): void {
    this.aviso.set(texto);
    setTimeout(() => {
      if (this.aviso() === texto) this.aviso.set('');
    }, 3500);
  }
}

function escapeHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// Zonas de auxilio como centros (ids negativos para no chocar con los recursos)
const CATEGORIA_ZONA: Partial<Record<NearbyZone['type'], CategoriaRecurso>> = {
  policia: 'policia', asistencia: 'salud', help: 'apoyo',
};

function desdeZona(z: NearbyZone): RecursoAyuda | null {
  const categoria = CATEGORIA_ZONA[z.type];
  if (!categoria) return null; // las zonas de riesgo y seguras no son centros de atención
  return {
    id: -z.id,
    nombre: z.name,
    categoria,
    descripcion: z.description ?? '',
    telefono: null,
    telefono2: null,
    email: null,
    direccion: z.address ?? null,
    ciudad: z.city ?? '',
    lat: z.lat,
    lng: z.lng,
  };
}
