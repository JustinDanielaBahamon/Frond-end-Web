// frequent-places.ts
import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { LocationTabsComponent } from '../../../shared/components/location-tabs/location-tabs';
import { FrequentPlaceService } from '../../../core/services/frequent-places.service';
import { FrequentPlace, PlaceType } from '../../../core/models/frequent-place.model';
import { AuthService } from '../../../core/auth/auth.service';

const ICONS: Record<PlaceType, string> = {
  home: 'M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5Z',
  work: 'M3 7h18v13H3zM8 7V4h8v3',
  study: 'M22 10 12 5 2 10l10 5 10-5Zm-10 5v6',
  other: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
};

const MARKER_COLORS: Record<PlaceType, string> = {
  home: 'violet', work: 'blue', study: 'gold', other: 'grey',
};

@Component({
  selector: 'app-frequent-places',
  standalone: true,
  imports: [CommonModule, LocationTabsComponent],
  templateUrl: './frequent-places.html',
  styleUrl: './frequent-places.scss'
})
export class FrequentPlacesComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private placeService = inject(FrequentPlaceService);
  private authService = inject(AuthService);

  private map!: L.Map;
  private viewReady = false;
  private userId = 0;

  loading = true;
  error = false;
  openMenu = signal<number | null>(null);

  places = signal<FrequentPlace[]>([]);

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

  ngAfterViewInit() { this.viewReady = true; this.initMapIfReady(); }

  private initMapIfReady() {
    if (!this.viewReady || this.places().length === 0 || this.map) return;
    const places = this.places();

    this.map = L.map(this.mapContainer.nativeElement, { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.map);

    const markers: L.Marker[] = [];
    places.forEach(p => {
      const icon = L.icon({
        iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${MARKER_COLORS[p.type]}.png`,
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41],
      });
      markers.push(L.marker([p.lat, p.lng], { icon }).addTo(this.map).bindPopup(p.name));
    });

    const group = L.featureGroup(markers);
    this.map.fitBounds(group.getBounds(), { padding: [50, 50] });

    // Fuerza el recálculo de tamaño una vez que el grid terminó de asentar el layout.
    setTimeout(() => this.map.invalidateSize(), 0);
  }

  toggleMenu(id: number) {
    this.openMenu.set(this.openMenu() === id ? null : id);
  }

  viewOnMap(place: FrequentPlace) {
    this.openMenu.set(null);
    this.mapContainer?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.map?.flyTo([place.lat, place.lng], 16, { duration: 1 });
  }

  remove(place: FrequentPlace) {
    this.openMenu.set(null);
    if (!confirm(`¿Eliminar "${place.name}" de tus lugares frecuentes?`)) return;
    this.placeService.delete(place.id).subscribe(() => {
      this.places.update(list => list.filter(p => p.id !== place.id));
    });
  }

  addPlace() {
    alert('Aquí abrimos el modal para agregar un nuevo lugar frecuente.');
  }

  ngOnDestroy() { if (this.map) this.map.remove(); }
}