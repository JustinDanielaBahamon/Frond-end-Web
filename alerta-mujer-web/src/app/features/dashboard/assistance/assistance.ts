import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { AssistanceService } from '../../../core/services/assistance.service';
import { LineaAyuda, CentroAyuda, RecursoGuardado, CategoriaCentro, TipoLinea } from '../../../core/models/assistance.model';
import { AuthService } from '../../../core/auth/auth.service';

type Tab = 'lineas' | 'centros' | 'recursos';
type FiltroCategoria = 'todos' | CategoriaCentro;

const ICONO_LINEA: Record<TipoLinea, string> = {
  emergencia: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z',
  policia: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  bomberos: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  mujeres: 'M12 21c-4.97 0-9-3-9-8a9 9 0 0 1 18 0c0 5-4.03 8-9 8Zm0 0v-4m-3 4h6',
  defensoria: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm0-14v6',
  saludMental: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
};

const COLOR_LINEA: Record<TipoLinea, string> = {
  emergencia: 'as-linea--rojo',
  policia: 'as-linea--azul',
  bomberos: 'as-linea--naranja',
  mujeres: 'as-linea--morado',
  defensoria: 'as-linea--teal',
  saludMental: 'as-linea--rosa',
};

const COLOR_CATEGORIA: Record<CategoriaCentro, string> = {
  mujeres: '#7c3aed',
  seguridad: '#1e3a8a',
  salud: '#0d9488',
  legal: '#d97706',
  psicologico: '#db2777',
  refugios: '#2563eb',
};

@Component({
  selector: 'app-assistance',
  standalone: true,
  imports: [CommonModule, NgClass, FormsModule],
  templateUrl: './assistance.html',
  styleUrl: './assistance.scss',
})
export class Assistance implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer?: ElementRef;

  private assistanceService = inject(AssistanceService);
  private authService = inject(AuthService);

  private map?: L.Map;
  private viewReady = false;
  private usuarioId = 0;

  loading = true;
  error = false;

  tabActivo: Tab = 'lineas';

  lineas: LineaAyuda[] = [];
  centros: CentroAyuda[] = [];
  recursosGuardados: RecursoGuardado[] = [];

  terminoBusquedaCentros = '';
  categoriaActiva: FiltroCategoria = 'todos';
  categorias: { key: FiltroCategoria; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'mujeres', label: 'Mujeres' },
    { key: 'seguridad', label: 'Seguridad' },
    { key: 'salud', label: 'Salud' },
    { key: 'legal', label: 'Legal' },
    { key: 'psicologico', label: 'Psicológico' },
    { key: 'refugios', label: 'Refugios' },
  ];

  ngOnInit() {
    this.authService.currentUser$.subscribe((usuario: any) => {
      if (!usuario) { this.error = true; this.loading = false; return; }
      this.usuarioId = usuario.id ?? usuario.usuarioId ?? 1;
      this.cargarDatos();
    });
  }

  private cargarDatos() {
    this.loading = true;
    this.error = false;

    this.assistanceService.getLineas().subscribe({
      next: (data) => { this.lineas = data; },
      error: () => { this.error = true; },
    });

    this.assistanceService.getCentros().subscribe({
      next: (data) => {
        this.centros = data;
        this.loading = false;
        this.initMapIfReady();
      },
      error: () => { this.error = true; this.loading = false; },
    });

    this.assistanceService.getRecursosGuardados(this.usuarioId).subscribe({
      next: (data) => { this.recursosGuardados = data; },
    });
  }

  ngAfterViewInit() {
    this.viewReady = true;
    this.initMapIfReady();
  }

  setTab(tab: Tab) {
    this.tabActivo = tab;
    // El contenedor del mapa puede cambiar de ancho al cambiar de tab;
    // se recalcula el tamaño para que Leaflet no quede con tiles cortados.
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  iconoLinea(tipo: TipoLinea) { return ICONO_LINEA[tipo] ?? ICONO_LINEA['emergencia']; }
  colorLinea(tipo: TipoLinea) { return COLOR_LINEA[tipo] ?? 'as-linea--morado'; }

  get centrosFiltrados(): CentroAyuda[] {
    let lista = this.categoriaActiva === 'todos'
      ? this.centros
      : this.centros.filter(c => c.categoria === this.categoriaActiva);

    const termino = this.terminoBusquedaCentros.trim().toLowerCase();
    if (termino) {
      lista = lista.filter(c =>
        c.nombre.toLowerCase().includes(termino) ||
        c.descripcion.toLowerCase().includes(termino)
      );
    }

    return lista.sort((a, b) => a.distanciaKm - b.distanciaKm);
  }

  setCategoria(cat: FiltroCategoria) { this.categoriaActiva = cat; }

  private initMapIfReady() {
    if (!this.viewReady || !this.mapContainer || this.centros.length === 0 || this.map) return;

    this.map = L.map(this.mapContainer.nativeElement, { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
      referrerPolicy: 'strict-origin-when-cross-origin',
    }).addTo(this.map);

    const markers: L.CircleMarker[] = [];
    this.centros.forEach(c => {
      const marker = L.circleMarker([c.lat, c.lng], {
        radius: 9,
        color: '#fff',
        weight: 2,
        fillColor: COLOR_CATEGORIA[c.categoria],
        fillOpacity: 1,
      }).addTo(this.map!).bindPopup(`<b>${c.nombre}</b><br>${c.descripcion}`);
      markers.push(marker);
    });

    const group = L.featureGroup(markers);
    this.map.fitBounds(group.getBounds(), { padding: [40, 40] });

    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  llamar(numero: string) {
    window.location.href = `tel:${numero.replace(/\s+/g, '')}`;
  }

  comoLlegar(centro: CentroAyuda) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${centro.lat},${centro.lng}`, '_blank');
  }

  centrarEnMapa(centro: CentroAyuda) {
    this.tabActivo = 'centros';
    setTimeout(() => this.map?.flyTo([centro.lat, centro.lng], 16, { duration: 1 }), 0);
  }

  esGuardado(refTipo: 'centro' | 'linea', refId: number): boolean {
    return this.recursosGuardados.some(r => r.refTipo === refTipo && r.refId === refId);
  }

  toggleGuardarCentro(centro: CentroAyuda) {
    const existente = this.recursosGuardados.find(r => r.refTipo === 'centro' && r.refId === centro.id);
    if (existente) {
      this.assistanceService.quitarRecurso(existente.id).subscribe(() => {
        this.recursosGuardados = this.recursosGuardados.filter(r => r.id !== existente.id);
      });
    } else {
      this.assistanceService.guardarRecurso({
        usuarioId: this.usuarioId,
        refTipo: 'centro',
        refId: centro.id,
        nombre: centro.nombre,
        subtitulo: `Entidad · ${centro.distanciaKm} km`,
      }).subscribe((creado) => { this.recursosGuardados = [...this.recursosGuardados, creado]; });
    }
  }

  toggleGuardarLinea(linea: LineaAyuda) {
    const existente = this.recursosGuardados.find(r => r.refTipo === 'linea' && r.refId === linea.id);
    if (existente) {
      this.assistanceService.quitarRecurso(existente.id).subscribe(() => {
        this.recursosGuardados = this.recursosGuardados.filter(r => r.id !== existente.id);
      });
    } else {
      this.assistanceService.guardarRecurso({
        usuarioId: this.usuarioId,
        refTipo: 'linea',
        refId: linea.id,
        nombre: linea.nombre,
        subtitulo: `Línea · ${linea.disponibilidad.replace('Disponible ', '')}`,
      }).subscribe((creado) => { this.recursosGuardados = [...this.recursosGuardados, creado]; });
    }
  }

  quitarRecursoGuardado(recurso: RecursoGuardado) {
    this.assistanceService.quitarRecurso(recurso.id).subscribe(() => {
      this.recursosGuardados = this.recursosGuardados.filter(r => r.id !== recurso.id);
    });
  }

  ngOnDestroy() { if (this.map) this.map.remove(); }
}