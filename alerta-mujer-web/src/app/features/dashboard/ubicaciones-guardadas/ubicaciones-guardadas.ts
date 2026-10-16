import {
  AfterViewInit, Component, ElementRef, Injector, OnDestroy, OnInit, ViewChild,
  computed, effect, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { FrequentPlaceService } from '../../../core/services/frequent-places.service';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FrequentPlace } from '../../../core/models/frequent-place.model';

type NivelRiesgo = 'muy_segura' | 'moderada' | 'muy_insegura';

// Neiva (Huila): mismo centro por defecto que la app móvil
const CENTRO_POR_DEFECTO: L.LatLngTuple = [2.9273, -75.2819];

// Mismos niveles y colores que la app móvil
export const NIVELES: Record<NivelRiesgo, { etiqueta: string; color: string }> = {
  muy_segura: { etiqueta: 'Muy segura', color: '#5316a3' },
  moderada: { etiqueta: 'Moderada', color: '#a70bf5' },
  muy_insegura: { etiqueta: 'Muy insegura', color: '#cb1ce6' },
};

const NOMBRES_RAPIDOS = ['Casa', 'Trabajo', 'Universidad', 'Colegio', 'Gimnasio'];

@Component({
  selector: 'app-ubicaciones-guardadas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ubicaciones-guardadas.html',
  styleUrl: './ubicaciones-guardadas.scss',
})
export class UbicacionesGuardadasComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  private frequentPlaceService = inject(FrequentPlaceService);
  private geocoding = inject(GeocodingService);
  private authService = inject(AuthService);
  private injector = inject(Injector);

  private map: L.Map | null = null;
  private resizeObserver?: ResizeObserver;
  private capaLugares = L.layerGroup();
  private capaPunto = L.layerGroup();
  private marcadores = new Map<number, L.Marker>();
  private vistaAjustada = false;

  readonly niveles = NIVELES;
  readonly nivelesLista = Object.keys(NIVELES) as NivelRiesgo[];
  readonly nombresRapidos = NOMBRES_RAPIDOS;

  // ── Datos ──────────────────────────────────────
  ubicaciones = signal<FrequentPlace[]>([]);
  cargando = signal(true);
  error = signal('');
  aviso = signal('');

  // ── Filtros ────────────────────────────────────
  busqueda = signal('');
  filtroRiesgo = signal<NivelRiesgo | null>(null);

  conteo = computed(() => {
    const c: Record<NivelRiesgo, number> = { muy_segura: 0, moderada: 0, muy_insegura: 0 };
    for (const u of this.ubicaciones()) c[this.nivelDe(u)]++;
    return c;
  });

  filtradas = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const nivel = this.filtroRiesgo();
    return this.ubicaciones().filter((u) => {
      if (nivel && this.nivelDe(u) !== nivel) return false;
      if (!termino) return true;
      return [u.name, u.address, u.city, u.notes].some((t) => (t ?? '').toLowerCase().includes(termino));
    });
  });

  seleccionada = signal<number | null>(null);

  // ── Formulario (crear / editar) ────────────────
  formVisible = signal(false);
  editandoId = signal<number | null>(null);
  eligiendoPunto = signal(false);
  punto = signal<{ lat: number; lng: number } | null>(null);
  nombre = signal('');
  direccion = signal('');
  ciudad = signal('');
  notas = signal('');
  nivel = signal<NivelRiesgo>('moderada');
  buscandoDireccion = signal(false);
  guardando = signal(false);
  errorForm = signal('');

  formValido = computed(() => !!this.punto() && this.nombre().trim().length > 0);

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((user: any) => {
      if (!user) {
        this.error.set('Debes iniciar sesión para ver tus ubicaciones.');
        this.cargando.set(false);
        return;
      }
      this.cargar(user.id);
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
    effect(() => this.dibujarLugares(), { injector: this.injector });
    effect(() => this.dibujarPunto(), { injector: this.injector });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
    this.map = null;
  }

  private cargar(userId: number): void {
    this.cargando.set(true);
    this.error.set('');
    this.frequentPlaceService.getByUser(userId).subscribe({
      next: (lista) => {
        this.ubicaciones.set(lista);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar tus ubicaciones. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  nivelDe(u: FrequentPlace): NivelRiesgo {
    return (u.riskLevel && u.riskLevel in NIVELES ? u.riskLevel : 'moderada') as NivelRiesgo;
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
    this.capaPunto.addTo(this.map);

    // Clic en el mapa: elige el punto de una ubicación nueva (o el nuevo punto de la que se edita)
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (!this.formVisible()) this.nueva();
      else if (this.editandoId() && !this.eligiendoPunto()) return;
      this.fijarPunto(e.latlng.lat, e.latlng.lng);
    });

    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }

  private dibujarLugares(): void {
    const lista = this.filtradas();
    const seleccionada = this.seleccionada();
    const editando = this.editandoId();
    if (!this.map) return;

    this.capaLugares.clearLayers();
    this.marcadores.clear();
    const bounds = L.latLngBounds([]);

    for (const u of lista) {
      if (!Number.isFinite(u.lat) || !Number.isFinite(u.lng) || u.id === editando) continue;
      const nivel = NIVELES[this.nivelDe(u)];
      const marcador = L.marker([u.lat, u.lng], {
        icon: iconoLugar(nivel.color, u.id === seleccionada),
        zIndexOffset: u.id === seleccionada ? 500 : 0,
      })
        .bindPopup(popupLugar(u, nivel))
        .on('click', () => this.seleccionada.set(u.id))
        .addTo(this.capaLugares);
      this.marcadores.set(u.id, marcador);
      bounds.extend([u.lat, u.lng]);
    }

    if (!this.vistaAjustada && bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
      this.vistaAjustada = true;
    }
  }

  private dibujarPunto(): void {
    const p = this.punto();
    const visible = this.formVisible();
    if (!this.map) return;
    this.capaPunto.clearLayers();
    if (!p || !visible) return;
    L.marker([p.lat, p.lng], { icon: iconoNuevo(NIVELES[this.nivel()].color), zIndexOffset: 1000 })
      .addTo(this.capaPunto);
  }

  verEnMapa(u: FrequentPlace): void {
    this.seleccionada.set(u.id);
    this.map?.flyTo([u.lat, u.lng], 16, { duration: 0.8 });
    setTimeout(() => this.marcadores.get(u.id)?.openPopup(), 850);
  }

  // ── Formulario ─────────────────────────────────
  nueva(): void {
    this.resetForm();
    this.formVisible.set(true);
    this.eligiendoPunto.set(true);
  }

  editar(u: FrequentPlace): void {
    this.resetForm();
    this.editandoId.set(u.id);
    this.punto.set({ lat: u.lat, lng: u.lng });
    this.nombre.set(u.name);
    this.direccion.set(u.address ?? '');
    this.ciudad.set(u.city ?? '');
    this.notas.set(u.notes ?? '');
    this.nivel.set(this.nivelDe(u));
    this.formVisible.set(true);
    this.map?.flyTo([u.lat, u.lng], 16, { duration: 0.8 });
  }

  cancelar(): void {
    this.formVisible.set(false);
    this.resetForm();
  }

  cambiarPunto(): void {
    this.eligiendoPunto.set(true);
  }

  usarMiUbicacion(): void {
    if (!navigator.geolocation) {
      this.errorForm.set('Tu navegador no permite obtener la ubicación.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!this.formVisible()) this.nueva();
        this.fijarPunto(pos.coords.latitude, pos.coords.longitude);
        this.map?.flyTo([pos.coords.latitude, pos.coords.longitude], 16, { duration: 0.8 });
      },
      () => this.errorForm.set('No se pudo obtener tu ubicación. Revisa los permisos del navegador.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  private fijarPunto(lat: number, lng: number): void {
    this.punto.set({ lat, lng });
    this.eligiendoPunto.set(false);
    this.errorForm.set('');

    // Dirección y ciudad automáticas (la usuaria puede corregirlas)
    this.buscandoDireccion.set(true);
    this.geocoding.obtener(lat, lng).then((lugar) => {
      if (!this.punto() || this.punto()!.lat !== lat || this.punto()!.lng !== lng) return;
      this.buscandoDireccion.set(false);
      if (!lugar) return;
      this.direccion.set([lugar.direccion, lugar.barrio].filter(Boolean).join(' · '));
      if (lugar.ciudad) this.ciudad.set(lugar.ciudad);
    });
  }

  guardar(): void {
    const p = this.punto();
    if (!p || !this.nombre().trim()) {
      this.errorForm.set(!p ? 'Elige el punto en el mapa o usa tu ubicación actual.' : 'Ponle un nombre a la ubicación.');
      return;
    }
    this.guardando.set(true);
    this.errorForm.set('');

    const datos: Partial<FrequentPlace> = {
      name: this.nombre().trim(),
      address: this.direccion().trim(),
      city: this.ciudad().trim(),
      notes: this.notas().trim(),
      riskLevel: this.nivel(),
      lat: p.lat,
      lng: p.lng,
    };
    const id = this.editandoId();
    const peticion = id
      ? this.frequentPlaceService.update(id, datos)
      : this.frequentPlaceService.create({ ...datos, isActive: true } as Omit<FrequentPlace, 'id'>);

    peticion.subscribe({
      next: (lugar) => {
        this.guardando.set(false);
        this.ubicaciones.update((prev) => (id ? prev.map((u) => (u.id === id ? lugar : u)) : [lugar, ...prev]));
        this.seleccionada.set(lugar.id);
        this.mostrarAviso(id ? 'Ubicación actualizada.' : 'Ubicación guardada. También aparece en la app móvil.');
        this.cancelar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorForm.set(err?.status === 400 ? 'Revisa los datos e intenta de nuevo.' : 'No se pudo guardar la ubicación.');
      },
    });
  }

  eliminar(u: FrequentPlace): void {
    if (!confirm(`¿Eliminar "${u.name}"? También se borrará de la app móvil.`)) return;
    this.frequentPlaceService.delete(u.id).subscribe({
      next: () => {
        this.ubicaciones.update((prev) => prev.filter((x) => x.id !== u.id));
        if (this.editandoId() === u.id) this.cancelar();
        this.mostrarAviso('Ubicación eliminada.');
      },
      error: () => this.mostrarAviso('No se pudo eliminar la ubicación.'),
    });
  }

  private resetForm(): void {
    this.editandoId.set(null);
    this.eligiendoPunto.set(false);
    this.punto.set(null);
    this.nombre.set('');
    this.direccion.set('');
    this.ciudad.set('');
    this.notas.set('');
    this.nivel.set('moderada');
    this.buscandoDireccion.set(false);
    this.errorForm.set('');
  }

  private mostrarAviso(texto: string): void {
    this.aviso.set(texto);
    setTimeout(() => {
      if (this.aviso() === texto) this.aviso.set('');
    }, 3500);
  }
}

function iconoLugar(color: string, activo: boolean): L.DivIcon {
  const size = activo ? 30 : 24;
  return L.divIcon({
    className: '',
    html: `<div class="ug-pin${activo ? ' ug-pin--active' : ''}" style="--pin:${color}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

function iconoNuevo(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="ug-pin ug-pin--new" style="--pin:${color}"></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
}

function popupLugar(u: FrequentPlace, nivel: { etiqueta: string; color: string }): string {
  const fila = (t?: string) => (t ? `<div class="ug-popup-row">${escapeHtml(t)}</div>` : '');
  return `
    <div class="ug-popup">
      <div class="ug-popup-name">${escapeHtml(u.name)}</div>
      ${fila(u.address)}${fila(u.city)}
      ${u.notes ? `<div class="ug-popup-notes">${escapeHtml(u.notes)}</div>` : ''}
      <div class="ug-popup-badge" style="color:${nivel.color}">● ${nivel.etiqueta}</div>
    </div>`;
}

function escapeHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
