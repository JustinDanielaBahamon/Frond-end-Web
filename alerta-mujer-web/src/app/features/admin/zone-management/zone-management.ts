import {
  Component, OnInit, OnDestroy, ElementRef, ViewChild, ChangeDetectorRef, HostListener, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ZonesService } from '../../../core/services/zones.Services';
import { Zone, ZoneType, ZoneStatus } from '../../../core/models/zone-management-model';
import { Modal } from '../../../shared/components/modal/modal';
import { compactPages } from '../../../shared/utils/paginacion';

// Leaflet se carga por CDN en index.html (igual que en el módulo de Alertas)
declare const L: any;

interface FilterChip {
  label: string;
  value: string;
}

interface ZoneForm {
  nombre: string;
  city: string;
  tipo: ZoneType;
  estado: ZoneStatus;
  lat: number | null;
  lng: number | null;
  radio: number;
}

type ModalMode = 'crear' | 'editar' | 'ver' | null;

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

  loading = true;
  private allZones: Zone[] = [];

  // ── Estado UI ────────────────────────────────────────────────
  filteredZones: Zone[] = [];
  searchTerm = '';
  typeFilter = 'Todas';

  readonly chips: FilterChip[] = [
    { label: 'Todas',        value: 'Todas' },
    { label: 'Riesgo Alto',  value: 'Riesgo Alto' },
    { label: 'Riesgo Medio', value: 'Riesgo Medio' },
    { label: 'Riesgo Bajo',  value: 'Riesgo Bajo' },
    { label: 'Seguras',      value: 'Segura' },
  ];

  currentPage = 1;
  perPage = 6;
  totalFiltered = 0;
  totalPageCount = 1;
  pages: (number | null)[] = [];

  // ── Modal (crear / editar / ver) ─────────────────────────────
  modal: ModalMode = null;
  selectedZone: Zone | null = null;
  saving = false;
  errorForm = '';

  readonly types: ZoneType[] = ['Riesgo Alto', 'Riesgo Medio', 'Riesgo Bajo', 'Segura'];
  readonly statuses: ZoneStatus[] = ['Activa', 'Revisión', 'Inactiva'];
  readonly quickRadii = [150, 300, 500, 1000];
  readonly suggestedCities = ['Neiva', 'Bogotá', 'Cali', 'Medellín', 'Barranquilla'];

  form: ZoneForm = this.emptyForm();

  // ── Mapa (Leaflet) ───────────────────────────────────────────
  @ViewChild('mapaModal') modalMap?: ElementRef<HTMLDivElement>;

  private map: any = null;
  private zoneLayer: any = null;

  private readonly initialCenter: [number, number] = [4.7110, -74.0721]; // Bogotá (igual que Alertas)
  private readonly cityCenters: Record<string, [number, number]> = {
    'neiva':        [2.9273, -75.2819],
    'bogota':       [4.7110, -74.0721],
    'cali':         [3.4516, -76.5320],
    'medellin':     [6.2442, -75.5812],
    'barranquilla': [10.9685, -74.7813],
  };

  // ── Estadísticas ─────────────────────────────────────────────
  get totalZones()       { return this.allZones.length; }
  get highRiskZones()  { return this.allZones.filter(z => z.tipo === 'Riesgo Alto').length; }
  get safeZones()     { return this.allZones.filter(z => z.tipo === 'Segura').length; }
  get zonesInReview()  { return this.allZones.filter(z => z.estado === 'Revisión').length; }

  // ── Texto de paginación ──────────────────────────────────────
  get from(): number {
    return this.totalFiltered === 0 ? 0 : (this.currentPage - 1) * this.perPage + 1;
  }

  get to(): number {
    return Math.min(this.currentPage * this.perPage, this.totalFiltered);
  }

  // ── Formulario ───────────────────────────────────────────────
  get formValid(): boolean {
    const dataOk = this.form.nombre.trim().length > 0 && this.form.city.trim().length > 0;
    // Al crear, la ubicación en el mapa es obligatoria. Al editar es opcional
    // (las zonas antiguas todavía no tienen coordenadas).
    const locationOk = this.modal === 'editar' || this.form.lat !== null;
    return dataOk && locationOk;
  }

  get formHasLocation(): boolean {
    return this.form.lat !== null && this.form.lng !== null;
  }

  // ── Lifecycle ────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadZones();
  }

  ngOnDestroy(): void {
    this.destroyMap();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modal) this.closeModal();
  }

  private loadZones(): void {
    this.loading = true;
    this.zonesService.getAll().subscribe({
      next: (zones) => {
        this.allZones = zones;
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando zonas:', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Filtros y paginación ─────────────────────────────────────
  applyFilters(): void {
    let result = [...this.allZones];

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(z =>
        z.nombre.toLowerCase().includes(term) ||
        z.city.toLowerCase().includes(term)
      );
    }

    if (this.typeFilter !== 'Todas') {
      result = result.filter(z => z.tipo === this.typeFilter);
    }

    this.totalFiltered = result.length;
    this.totalPageCount = Math.ceil(this.totalFiltered / this.perPage) || 1;
    if (this.currentPage > this.totalPageCount) this.currentPage = 1;

    const start = (this.currentPage - 1) * this.perPage;
    this.filteredZones = result.slice(start, start + this.perPage);
    this.pages = compactPages(this.currentPage, this.totalPageCount);
  }

  setChip(value: string): void {
    this.typeFilter = value;
    this.currentPage = 1;
    this.applyFilters();
  }

  changePage(p: number): void {
    if (p < 1 || p > this.totalPageCount) return;
    this.currentPage = p;
    this.applyFilters();
  }

  clearAll(): void {
    this.searchTerm = '';
    this.typeFilter = 'Todas';
    this.currentPage = 1;
    this.applyFilters();
  }

  // ── Acciones: abrir modales ──────────────────────────────────
  openCreate(): void {
    this.selectedZone = null;
    this.form = this.emptyForm();
    this.errorForm = '';
    this.modal = 'crear';
    this.openModalWithMap(true);
  }

  viewZone(z: Zone): void {
    this.selectedZone = z;
    this.form = this.formFromZone(z);
    this.errorForm = '';
    this.modal = 'ver';
    this.openModalWithMap(false);
  }

  editZone(z: Zone): void {
    this.selectedZone = z;
    this.form = this.formFromZone(z);
    this.errorForm = '';
    this.modal = 'editar';
    this.openModalWithMap(true);
  }

  /** Desde el modal "ver" pasa directo a editar la misma zona */
  editFromView(): void {
    if (this.selectedZone) this.editZone(this.selectedZone);
  }

  closeModal(): void {
    this.destroyMap();
    this.modal = null;
    this.selectedZone = null;
    this.saving = false;
    this.errorForm = '';
  }

  // ── Acciones: guardar (crear / editar) ───────────────────────
  save(): void {
    if (!this.formValid || this.saving) return;

    this.saving = true;
    this.errorForm = '';

    const base: Omit<Zone, 'id' | 'alerts'> = {
      nombre: this.form.nombre.trim(),
      city: this.form.city.trim(),
      tipo: this.form.tipo,
      estado: this.form.estado,
      updated_at: new Date().toISOString(),
      ...(this.formHasLocation
        ? { lat: this.form.lat as number, lng: this.form.lng as number, radio: this.form.radio }
        : {}),
    };

    if (this.modal === 'editar' && this.selectedZone) {
      const id = this.selectedZone.id;

      this.zonesService.update(id, base).subscribe({
        next: (updated) => {
          this.allZones = this.allZones.map(z =>
            z.id === id ? { ...z, ...base, ...updated } : z
          );
          this.applyFilters();
          this.closeModal();
          this.cdr.detectChanges();
        },
        error: (err) => this.showSaveError(err),
      });
      return;
    }

    this.zonesService.create({ ...base, alerts: 0 }).subscribe({
      next: (created) => {
        this.allZones = [...this.allZones, created];

        // Limpia filtros y salta a la última página para que la zona nueva se vea
        this.searchTerm = '';
        this.typeFilter = 'Todas';
        this.currentPage = Math.ceil(this.allZones.length / this.perPage) || 1;
        this.applyFilters();

        this.closeModal();
        this.cdr.detectChanges();
      },
      error: (err) => this.showSaveError(err),
    });
  }

  private showSaveError(err: unknown): void {
    console.error('Error guardando zona:', err);
    this.saving = false;
    this.errorForm = 'No se pudo guardar la zona. Verifica que la API (json-server) esté corriendo.';
    this.cdr.detectChanges();
  }

  // ── Acciones: eliminar ───────────────────────────────────────
  deleteZone(z: Zone): void {
    if (!confirm(`¿Eliminar la zona "${z.nombre}"?`)) return;

    this.zonesService.delete(z.id).subscribe({
      next: () => {
        this.allZones = this.allZones.filter(x => x.id !== z.id);
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error eliminando zona:', err)
    });
  }

  // ── Formulario: cambios de campos ────────────────────────────
  setType(tipo: ZoneType): void {
    this.form.tipo = tipo;
    this.drawZone(); // cambia el color en el mapa
  }

  setStatus(estado: ZoneStatus): void {
    this.form.estado = estado;
  }

  setRadio(radio: number | string): void {
    this.form.radio = Number(radio);
    this.drawZone();
  }

  /** Si todavía no hay punto marcado, centra el mapa en la ciudad escrita */
  onCityChange(): void {
    if (!this.map || this.formHasLocation) return;
    const center = this.cityCenters[this.normalize(this.form.city)];
    if (center) this.map.flyTo(center, 13, { duration: 0.6 });
  }

  hasLocation(z: Zone | null): boolean {
    return !!z && Number.isFinite(z.lat) && Number.isFinite(z.lng);
  }

  // ── Mapa ─────────────────────────────────────────────────────
  private openModalWithMap(editable: boolean): void {
    // Renderiza el modal ya mismo para que exista el contenedor del mapa
    this.cdr.detectChanges();
    this.mountMap(editable);
  }

  private mountMap(editable: boolean): void {
    this.destroyMap();

    if (typeof L === 'undefined') {
      console.warn('Leaflet no cargado — agrega el CDN en index.html');
      return;
    }
    if (!this.modalMap) return; // p. ej. modal "ver" de una zona sin ubicación

    const center = this.mapCenter();

    this.map = L.map(this.modalMap.nativeElement, {
      center,
      zoom: this.formHasLocation ? 15 : 13,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(this.map);

    if (editable) {
      this.map.on('click', (e: any) => {
        this.form.lat = parseFloat(e.latlng.lat.toFixed(6));
        this.form.lng = parseFloat(e.latlng.lng.toFixed(6));
        this.drawZone();
        this.cdr.detectChanges();
      });
    }

    this.drawZone();

    // El modal acaba de aparecer: Leaflet necesita recalcular su tamaño
    setTimeout(() => this.map?.invalidateSize(), 200);
  }

  private mapCenter(): [number, number] {
    if (this.formHasLocation) return [this.form.lat as number, this.form.lng as number];
    return this.cityCenters[this.normalize(this.form.city)] ?? this.initialCenter;
  }

  /** Pinta (o repinta) el círculo + centro de la zona del formulario */
  private drawZone(): void {
    if (!this.map) return;

    if (this.zoneLayer) {
      this.map.removeLayer(this.zoneLayer);
      this.zoneLayer = null;
    }
    if (!this.formHasLocation) return;

    const point: [number, number] = [this.form.lat as number, this.form.lng as number];
    const color = this.colorByType(this.form.tipo);

    const circle = L.circle(point, {
      radius: this.form.radio, color, fillColor: color, fillOpacity: 0.2, weight: 2,
    });
    const center = L.circleMarker(point, {
      radius: 6, fillColor: color, color: '#fff', weight: 2, fillOpacity: 1,
    });

    this.zoneLayer = L.layerGroup([circle, center]).addTo(this.map);
  }

  private destroyMap(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.zoneLayer = null;
  }

  private colorByType(tipo: ZoneType): string {
    const map: Record<ZoneType, string> = {
      'Riesgo Alto':  '#d946ef',
      'Riesgo Medio': '#c084fc',
      'Riesgo Bajo':  '#a855f7',
      'Segura':       '#8b5cf6',
    };
    return map[tipo] ?? '#8b5cf6';
  }

  // ── Helpers internos del formulario ──────────────────────────
  private emptyForm(): ZoneForm {
    return { nombre: '', city: '', tipo: 'Riesgo Alto', estado: 'Activa', lat: null, lng: null, radio: 300 };
  }

  private formFromZone(z: Zone): ZoneForm {
    return {
      nombre: z.nombre,
      city: z.city,
      tipo: z.tipo,
      estado: z.estado,
      lat: Number.isFinite(z.lat) ? (z.lat as number) : null,
      lng: Number.isFinite(z.lng) ? (z.lng as number) : null,
      radio: z.radio ?? 300,
    };
  }

  /** "Bogotá " → "bogota" (para buscar la ciudad sin tildes ni mayúsculas) */
  private normalize(text: string): string {
    return text.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  // ── Helpers de estilo ────────────────────────────────────────
  getAvatarClass(tipo: ZoneType): string {
    const map: Record<ZoneType, string> = {
      'Riesgo Alto':  'red',
      'Riesgo Medio': 'yellow',
      'Riesgo Bajo':  'orange',
      'Segura':       'green',
    };
    return map[tipo] ?? '';
  }

  getBadgeClass(tipo: ZoneType): string {
    const map: Record<ZoneType, string> = {
      'Riesgo Alto':  'badge-red',
      'Riesgo Medio': 'badge-yellow',
      'Riesgo Bajo':  'badge-orange',
      'Segura':       'badge-green',
    };
    return map[tipo] ?? '';
  }

  getStatusClass(estado: ZoneStatus): string {
    const map: Record<ZoneStatus, string> = {
      'Activa':   'active',
      'Revisión': 'review',
      'Inactiva': 'inactive',
    };
    return map[estado] ?? '';
  }

  // "Hace 2 horas", "Hace 1 día", etc. a partir de la fecha ISO
  relativeTime(iso: string): string {
    const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);

    if (minutos < 1)  return 'Hace un momento';
    if (minutos < 60) return `Hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;

    const hours = Math.floor(minutos / 60);
    if (hours < 24) return `Hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;

    const days = Math.floor(hours / 24);
    return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
  }
}