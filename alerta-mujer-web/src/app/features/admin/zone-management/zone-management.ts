import {
  Component, OnInit, OnDestroy, ElementRef, ViewChild, ChangeDetectorRef, HostListener, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ZonesService } from '../../../core/services/zones.Services';
import { Zona, TipoZona, EstadoZona } from '../../../core/models/zone-management-model';
import { Modal } from '../../../shared/components/modal/modal';

// Leaflet se carga por CDN en index.html (igual que en el módulo de Alertas)
declare const L: any;

interface ChipFiltro {
  label: string;
  value: string;
}

interface ZonaForm {
  nombre: string;
  ciudad: string;
  tipo: TipoZona;
  estado: EstadoZona;
  lat: number | null;
  lng: number | null;
  radio: number;
}

type ModoModal = 'crear' | 'editar' | 'ver' | null;

@Component({
  selector: 'app-zone-management',
  standalone: true,
  imports: [CommonModule, FormsModule, Modal],
  templateUrl: './zone-management.html',
  styleUrl: './zone-management.scss',
})
export class ZoneManagementComponent implements OnInit, OnDestroy {

  private zonesService = inject(ZonesService);
  private cdr = inject(ChangeDetectorRef);

  cargando = true;
  private todasLasZonas: Zona[] = [];

  // ── Estado UI ────────────────────────────────────────────────
  zonasFiltradas: Zona[] = [];
  searchTerm = '';
  filtroTipo = 'Todas';

  readonly chips: ChipFiltro[] = [
    { label: 'Todas',        value: 'Todas' },
    { label: 'Riesgo Alto',  value: 'Riesgo Alto' },
    { label: 'Riesgo Medio', value: 'Riesgo Medio' },
    { label: 'Riesgo Bajo',  value: 'Riesgo Bajo' },
    { label: 'Seguras',      value: 'Segura' },
  ];

  paginaActual = 1;
  porPagina = 6;
  totalFiltradas = 0;
  totalPaginas = 1;
  paginas: number[] = [];

  // ── Modal (crear / editar / ver) ─────────────────────────────
  modal: ModoModal = null;
  zonaSeleccionada: Zona | null = null;
  guardando = false;
  errorForm = '';

  readonly tipos: TipoZona[] = ['Riesgo Alto', 'Riesgo Medio', 'Riesgo Bajo', 'Segura'];
  readonly estados: EstadoZona[] = ['Activa', 'Revisión', 'Inactiva'];
  readonly radiosRapidos = [150, 300, 500, 1000];
  readonly ciudadesSugeridas = ['Neiva', 'Bogotá', 'Cali', 'Medellín', 'Barranquilla'];

  form: ZonaForm = this.formVacio();

  // ── Mapa (Leaflet) ───────────────────────────────────────────
  @ViewChild('mapaModal') mapaModal?: ElementRef<HTMLDivElement>;

  private mapa: any = null;
  private capaZona: any = null;

  private readonly centroInicial: [number, number] = [4.7110, -74.0721]; // Bogotá (igual que Alertas)
  private readonly centrosCiudad: Record<string, [number, number]> = {
    'neiva':        [2.9273, -75.2819],
    'bogota':       [4.7110, -74.0721],
    'cali':         [3.4516, -76.5320],
    'medellin':     [6.2442, -75.5812],
    'barranquilla': [10.9685, -74.7813],
  };

  // ── Estadísticas ─────────────────────────────────────────────
  get totalZonas()       { return this.todasLasZonas.length; }
  get zonasRiesgoAlto()  { return this.todasLasZonas.filter(z => z.tipo === 'Riesgo Alto').length; }
  get zonasSeguras()     { return this.todasLasZonas.filter(z => z.tipo === 'Segura').length; }
  get zonasEnRevision()  { return this.todasLasZonas.filter(z => z.estado === 'Revisión').length; }

  // ── Texto de paginación ──────────────────────────────────────
  get desde(): number {
    return this.totalFiltradas === 0 ? 0 : (this.paginaActual - 1) * this.porPagina + 1;
  }

  get hasta(): number {
    return Math.min(this.paginaActual * this.porPagina, this.totalFiltradas);
  }

  // ── Formulario ───────────────────────────────────────────────
  get formValido(): boolean {
    const datosOk = this.form.nombre.trim().length > 0 && this.form.ciudad.trim().length > 0;
    // Al crear, la ubicación en el mapa es obligatoria. Al editar es opcional
    // (las zonas antiguas todavía no tienen coordenadas).
    const ubicacionOk = this.modal === 'editar' || this.form.lat !== null;
    return datosOk && ubicacionOk;
  }

  get formTieneUbicacion(): boolean {
    return this.form.lat !== null && this.form.lng !== null;
  }

  // ── Lifecycle ────────────────────────────────────────────────
  ngOnInit(): void {
    this.cargarZonas();
  }

  ngOnDestroy(): void {
    this.destruirMapa();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modal) this.cerrarModal();
  }

  private cargarZonas(): void {
    this.cargando = true;
    this.zonesService.getAll().subscribe({
      next: (zonas) => {
        this.todasLasZonas = zonas;
        this.applyFilters();
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error cargando zonas:', err);
        this.cargando = false;
      }
    });
  }

  // ── Filtros y paginación ─────────────────────────────────────
  applyFilters(): void {
    let resultado = [...this.todasLasZonas];

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      resultado = resultado.filter(z =>
        z.nombre.toLowerCase().includes(term) ||
        z.ciudad.toLowerCase().includes(term)
      );
    }

    if (this.filtroTipo !== 'Todas') {
      resultado = resultado.filter(z => z.tipo === this.filtroTipo);
    }

    this.totalFiltradas = resultado.length;
    this.totalPaginas = Math.ceil(this.totalFiltradas / this.porPagina) || 1;
    if (this.paginaActual > this.totalPaginas) this.paginaActual = 1;

    const start = (this.paginaActual - 1) * this.porPagina;
    this.zonasFiltradas = resultado.slice(start, start + this.porPagina);
    this.paginas = Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  setChip(value: string): void {
    this.filtroTipo = value;
    this.paginaActual = 1;
    this.applyFilters();
  }

  cambiarPagina(p: number): void {
    if (p < 1 || p > this.totalPaginas) return;
    this.paginaActual = p;
    this.applyFilters();
  }

  clearAll(): void {
    this.searchTerm = '';
    this.filtroTipo = 'Todas';
    this.paginaActual = 1;
    this.applyFilters();
  }

  // ── Acciones: abrir modales ──────────────────────────────────
  abrirCrear(): void {
    this.zonaSeleccionada = null;
    this.form = this.formVacio();
    this.errorForm = '';
    this.modal = 'crear';
    this.abrirModalConMapa(true);
  }

  verZona(z: Zona): void {
    this.zonaSeleccionada = z;
    this.form = this.formDesdeZona(z);
    this.errorForm = '';
    this.modal = 'ver';
    this.abrirModalConMapa(false);
  }

  editarZona(z: Zona): void {
    this.zonaSeleccionada = z;
    this.form = this.formDesdeZona(z);
    this.errorForm = '';
    this.modal = 'editar';
    this.abrirModalConMapa(true);
  }

  /** Desde el modal "ver" pasa directo a editar la misma zona */
  editarDesdeVer(): void {
    if (this.zonaSeleccionada) this.editarZona(this.zonaSeleccionada);
  }

  cerrarModal(): void {
    this.destruirMapa();
    this.modal = null;
    this.zonaSeleccionada = null;
    this.guardando = false;
    this.errorForm = '';
  }

  // ── Acciones: guardar (crear / editar) ───────────────────────
  guardar(): void {
    if (!this.formValido || this.guardando) return;

    this.guardando = true;
    this.errorForm = '';

    const base: Omit<Zona, 'id' | 'alertas'> = {
      nombre: this.form.nombre.trim(),
      ciudad: this.form.ciudad.trim(),
      tipo: this.form.tipo,
      estado: this.form.estado,
      updated_at: new Date().toISOString(),
      ...(this.formTieneUbicacion
        ? { lat: this.form.lat as number, lng: this.form.lng as number, radio: this.form.radio }
        : {}),
    };

    if (this.modal === 'editar' && this.zonaSeleccionada) {
      const id = this.zonaSeleccionada.id;

      this.zonesService.actualizar(id, base).subscribe({
        next: (actualizada) => {
          this.todasLasZonas = this.todasLasZonas.map(z =>
            z.id === id ? { ...z, ...base, ...actualizada } : z
          );
          this.applyFilters();
          this.cerrarModal();
          this.cdr.detectChanges();
        },
        error: (err) => this.mostrarErrorGuardado(err),
      });
      return;
    }

    this.zonesService.crear({ ...base, alertas: 0 }).subscribe({
      next: (creada) => {
        this.todasLasZonas = [...this.todasLasZonas, creada];

        // Limpia filtros y salta a la última página para que la zona nueva se vea
        this.searchTerm = '';
        this.filtroTipo = 'Todas';
        this.paginaActual = Math.ceil(this.todasLasZonas.length / this.porPagina) || 1;
        this.applyFilters();

        this.cerrarModal();
        this.cdr.detectChanges();
      },
      error: (err) => this.mostrarErrorGuardado(err),
    });
  }

  private mostrarErrorGuardado(err: unknown): void {
    console.error('Error guardando zona:', err);
    this.guardando = false;
    this.errorForm = 'No se pudo guardar la zona. Verifica que la API (json-server) esté corriendo.';
    this.cdr.detectChanges();
  }

  // ── Acciones: eliminar ───────────────────────────────────────
  eliminarZona(z: Zona): void {
    if (!confirm(`¿Eliminar la zona "${z.nombre}"?`)) return;

    this.zonesService.eliminar(z.id).subscribe({
      next: () => {
        this.todasLasZonas = this.todasLasZonas.filter(x => x.id !== z.id);
        this.applyFilters();
      },
      error: (err) => console.error('Error eliminando zona:', err)
    });
  }

  // ── Formulario: cambios de campos ────────────────────────────
  setTipo(tipo: TipoZona): void {
    this.form.tipo = tipo;
    this.dibujarZona(); // cambia el color en el mapa
  }

  setEstado(estado: EstadoZona): void {
    this.form.estado = estado;
  }

  setRadio(radio: number | string): void {
    this.form.radio = Number(radio);
    this.dibujarZona();
  }

  /** Si todavía no hay punto marcado, centra el mapa en la ciudad escrita */
  onCiudadChange(): void {
    if (!this.mapa || this.formTieneUbicacion) return;
    const centro = this.centrosCiudad[this.normalizar(this.form.ciudad)];
    if (centro) this.mapa.flyTo(centro, 13, { duration: 0.6 });
  }

  tieneUbicacion(z: Zona | null): boolean {
    return !!z && Number.isFinite(z.lat) && Number.isFinite(z.lng);
  }

  // ── Mapa ─────────────────────────────────────────────────────
  private abrirModalConMapa(editable: boolean): void {
    // Renderiza el modal ya mismo para que exista el contenedor del mapa
    this.cdr.detectChanges();
    this.montarMapa(editable);
  }

  private montarMapa(editable: boolean): void {
    this.destruirMapa();

    if (typeof L === 'undefined') {
      console.warn('Leaflet no cargado — agrega el CDN en index.html');
      return;
    }
    if (!this.mapaModal) return; // p. ej. modal "ver" de una zona sin ubicación

    const centro = this.centroParaMapa();

    this.mapa = L.map(this.mapaModal.nativeElement, {
      center: centro,
      zoom: this.formTieneUbicacion ? 15 : 13,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(this.mapa);

    if (editable) {
      this.mapa.on('click', (e: any) => {
        this.form.lat = parseFloat(e.latlng.lat.toFixed(6));
        this.form.lng = parseFloat(e.latlng.lng.toFixed(6));
        this.dibujarZona();
        this.cdr.detectChanges();
      });
    }

    this.dibujarZona();

    // El modal acaba de aparecer: Leaflet necesita recalcular su tamaño
    setTimeout(() => this.mapa?.invalidateSize(), 200);
  }

  private centroParaMapa(): [number, number] {
    if (this.formTieneUbicacion) return [this.form.lat as number, this.form.lng as number];
    return this.centrosCiudad[this.normalizar(this.form.ciudad)] ?? this.centroInicial;
  }

  /** Pinta (o repinta) el círculo + centro de la zona del formulario */
  private dibujarZona(): void {
    if (!this.mapa) return;

    if (this.capaZona) {
      this.mapa.removeLayer(this.capaZona);
      this.capaZona = null;
    }
    if (!this.formTieneUbicacion) return;

    const punto: [number, number] = [this.form.lat as number, this.form.lng as number];
    const color = this.colorPorTipo(this.form.tipo);

    const circulo = L.circle(punto, {
      radius: this.form.radio, color, fillColor: color, fillOpacity: 0.2, weight: 2,
    });
    const centro = L.circleMarker(punto, {
      radius: 6, fillColor: color, color: '#fff', weight: 2, fillOpacity: 1,
    });

    this.capaZona = L.layerGroup([circulo, centro]).addTo(this.mapa);
  }

  private destruirMapa(): void {
    if (this.mapa) {
      this.mapa.remove();
      this.mapa = null;
    }
    this.capaZona = null;
  }

  private colorPorTipo(tipo: TipoZona): string {
    const map: Record<TipoZona, string> = {
      'Riesgo Alto':  '#ef4444',
      'Riesgo Medio': '#eab308',
      'Riesgo Bajo':  '#f97316',
      'Segura':       '#22c55e',
    };
    return map[tipo] ?? '#8b5cf6';
  }

  // ── Helpers internos del formulario ──────────────────────────
  private formVacio(): ZonaForm {
    return { nombre: '', ciudad: '', tipo: 'Riesgo Alto', estado: 'Activa', lat: null, lng: null, radio: 300 };
  }

  private formDesdeZona(z: Zona): ZonaForm {
    return {
      nombre: z.nombre,
      ciudad: z.ciudad,
      tipo: z.tipo,
      estado: z.estado,
      lat: Number.isFinite(z.lat) ? (z.lat as number) : null,
      lng: Number.isFinite(z.lng) ? (z.lng as number) : null,
      radio: z.radio ?? 300,
    };
  }

  /** "Bogotá " → "bogota" (para buscar la ciudad sin tildes ni mayúsculas) */
  private normalizar(texto: string): string {
    return texto.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  // ── Helpers de estilo ────────────────────────────────────────
  getAvatarClass(tipo: TipoZona): string {
    const map: Record<TipoZona, string> = {
      'Riesgo Alto':  'red',
      'Riesgo Medio': 'yellow',
      'Riesgo Bajo':  'orange',
      'Segura':       'green',
    };
    return map[tipo] ?? '';
  }

  getBadgeClass(tipo: TipoZona): string {
    const map: Record<TipoZona, string> = {
      'Riesgo Alto':  'badge-red',
      'Riesgo Medio': 'badge-yellow',
      'Riesgo Bajo':  'badge-orange',
      'Segura':       'badge-green',
    };
    return map[tipo] ?? '';
  }

  getStatusClass(estado: EstadoZona): string {
    const map: Record<EstadoZona, string> = {
      'Activa':   'active',
      'Revisión': 'review',
      'Inactiva': 'inactive',
    };
    return map[estado] ?? '';
  }

  // "Hace 2 horas", "Hace 1 día", etc. a partir de la fecha ISO
  tiempoRelativo(iso: string): string {
    const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);

    if (minutos < 1)  return 'Hace un momento';
    if (minutos < 60) return `Hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;

    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;

    const dias = Math.floor(horas / 24);
    return `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
  }
}