// frequent-places.ts
import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { LocationTabsComponent } from '../../../shared/components/location-tabs/location-tabs';
import { FrequentPlaceService } from '../../../core/services/frequent-places.service';
import { FrequentPlace, PlaceType } from '../../../core/models/frequent-place.model';
import { AuthService } from '../../../core/auth/auth.service';
import { markerIcon } from '../../../core/utils/geo.util';

const ICONS: Record<PlaceType, string> = {
  home: 'M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5Z',
  work: 'M3 7h18v13H3zM8 7V4h8v3',
  study: 'M22 10 12 5 2 10l10 5 10-5Zm-10 5v6',
  other: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
};

// El backend no clasifica lugares por tipo: todos usan el marcador neutro.
const MARKER_COLOR = '#6b7280';

@Component({
  selector: 'app-frequent-places',
  standalone: true,
  imports: [CommonModule, FormsModule, LocationTabsComponent],
  templateUrl: './frequent-places.html',
  styleUrl: './frequent-places.scss'
})
export class FrequentPlacesComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private placeService = inject(FrequentPlaceService);
  private authService = inject(AuthService);

  private map: L.Map | null = null;
  private viewReady = false;
  private userId = 0;

  loading = true;
  error = false;
  openMenu = signal<number | null>(null);

  places = signal<FrequentPlace[]>([]);

  // ── Formulario crear/editar (CRUD real) ─────────────
  modalAbierto = signal(false);
  editandoId = signal<number | null>(null);
  formError = signal('');
  enviando = false;
  form = {
    name: '',
    address: '',
    city: '',
    lat: '',
    lng: '',
    notes: '',
  };

  iconPath(type: PlaceType) { return ICONS[type] ?? ICONS['other']; }

  ngOnInit() {
    this.authService.currentUser$.subscribe((user: any) => {
      if (!user) { this.error = true; this.loading = false; return; }
      this.userId = user.id ?? user.usuarioId ?? 1;
      this.loadData();
    });
  }

  private loadData() {
    this.loading = true;
    this.error = false;
    this.placeService.getByUser(this.userId).subscribe({
      next: (data) => { this.places.set(data); this.loading = false; this.initMapIfReady(); },
      error: () => { this.error = true; this.loading = false; },
    });
  }

  ngAfterViewInit() {
    this.viewReady = true;
    this.initMapIfReady();
    setTimeout(() => this.map?.invalidateSize(), 100);
  }

  private initMapIfReady() {
    if (!this.viewReady || this.places().length === 0 || this.map) return;
    const places = this.places();

    const contenedor = this.mapContainer?.nativeElement;
    if (!contenedor) return;

    this.map = L.map(contenedor, { scrollWheelZoom: false, zoomControl: true });
    const mapa = this.map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(mapa);

    const markers: L.Marker[] = [];
    places.forEach(p => {
      // El backend no clasifica lugares: marcador neutro con el color del módulo.
      markers.push(L.marker([p.lat, p.lng], { icon: markerIcon('#6b7280') }).addTo(mapa).bindPopup(
        `${p.name}<br>${p.address || `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`}`,
      ));
    });

    const group = L.featureGroup(markers);
    mapa.fitBounds(group.getBounds(), { padding: [50, 50] });

    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  /** Reconstruye el mapa después de crear/eliminar (fitBounds nuevos). */
  private reconstruirMapa() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.initMapIfReady();
  }

  toggleMenu(id: number) {
    this.openMenu.set(this.openMenu() === id ? null : id);
  }

  viewOnMap(place: FrequentPlace) {
    this.openMenu.set(null);
    this.mapContainer?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.map?.flyTo([place.lat, place.lng], 16, { duration: 1 });
  }

  // ── CRUD ────────────────────────────────────────────
  abrirModalCrear() {
    this.editandoId.set(null);
    this.form = { name: '', address: '', city: '', lat: '', lng: '', notes: '' };
    this.formError.set('');
    this.modalAbierto.set(true);
  }

  abrirModalEditar(place: FrequentPlace) {
    this.editandoId.set(place.id);
    this.form = {
      name: place.name,
      address: place.address,
      city: place.city,
      lat: String(place.lat),
      lng: String(place.lng),
      notes: place.notes ?? '',
    };
    this.formError.set('');
    this.modalAbierto.set(true);
  }

  cerrarModal() {
    if (this.enviando) return;
    this.modalAbierto.set(false);
  }

  guardar() {
    const lat = Number(this.form.lat);
    const lng = Number(this.form.lng);
    if (!this.form.name.trim()) { this.formError.set('El nombre es obligatorio.'); return; }
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      this.formError.set('Latitud y longitud deben ser coordenadas válidas.');
      return;
    }

    this.enviando = true;
    this.formError.set('');

    const payload = {
      userId: this.userId,
      name: this.form.name.trim(),
      address: this.form.address.trim(),
      city: this.form.city.trim(),
      lat,
      lng,
      notes: this.form.notes.trim(),
    };

    const peticion = this.editandoId() !== null
      ? this.placeService.update(this.editandoId()!, payload)
      : this.placeService.create(payload);

    peticion.subscribe({
      next: () => {
        this.enviando = false;
        this.modalAbierto.set(false);
        this.loadData();
        this.reconstruirMapa();
      },
      error: () => {
        this.enviando = false;
        this.formError.set('No se pudo guardar el lugar. Intenta de nuevo.');
      },
    });
  }

  remove(place: FrequentPlace) {
    this.openMenu.set(null);
    if (!confirm(`¿Eliminar "${place.name}" de tus lugares frecuentes?`)) return;
    this.placeService.delete(place.id).subscribe({
      next: () => {
        this.places.update(list => list.filter(p => p.id !== place.id));
        this.reconstruirMapa();
      },
      error: () => { alert('No se pudo eliminar el lugar. Intenta de nuevo.'); },
    });
  }

  ngOnDestroy() { if (this.map) { this.map.remove(); this.map = null; } }
}
