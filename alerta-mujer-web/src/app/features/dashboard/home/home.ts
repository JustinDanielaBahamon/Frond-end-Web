import { AfterViewInit, Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import { zoneIcon } from '../../../core/utils/zone-icon';
import { ZonesService } from '../../../core/services/zones.service';
import { NearbyZone } from '../../../core/models/nearby-zone.model';
import { UserSecurityStatusService } from '../../../core/services/user-security-status.service';
import { SecurityLevel, SecurityStatus } from '../../../core/models/security-status.model';
import { AuthService } from '../../../core/auth/auth.service';
import { DeviceService, UserDevice } from '../../../core/services/device.service';
import { PhoneLocationService } from '../../../core/services/phone.location.services';
import { AlertsService } from '../../../core/services/alerts.services';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { Alert } from '../../../core/models/alert.model';
import { LocationEntry } from '../../../core/models/location.model';

interface SecurityItem {
  icon: string;
  value: string;
  description: string;
  configured: boolean;
  tooltip?: string;
}

interface LastLocation {
  lat: number;
  lng: number;
  address: string;
  date: string;
  coordinates: string;
  precision: string;
}

interface LastEmergency {
  id: number;
  date: string;
  time: string;
  location: string;
  activatedBy: string;
  notifiedContacts: number | null;
  status: string;
}

interface QuickAccess {
  icon: string;
  label: string;
  sub: string;
  route: string;
}

// While there is no phone location, the map shows Neiva
const DEFAULT_CENTER: L.LatLngTuple = [2.9273, -75.2819];

const longDate = (d: Date) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
const shortTime = (d: Date) => d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgClass, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit, AfterViewInit, OnDestroy {

  private map: L.Map | null = null;
  private zoneService = inject(ZonesService);
  private securityStatusService = inject(UserSecurityStatusService);
  private authService = inject(AuthService);
  private deviceService = inject(DeviceService);
  private phoneLocation = inject(PhoneLocationService);
  private alertsService = inject(AlertsService);
  private geocoding = inject(GeocodingService);
  private destroyRef = inject(DestroyRef);
  private zones: NearbyZone[] = [];
  private userMarker: L.Marker | null = null;
  private zoneCircles: L.Circle[] = [];
  private zoneMarkers: L.Marker[] = [];

  // ── ESTADO DE SEGURIDAD ───────────────────────────
  isLoadingStatus = signal(true);
  securityStatus = signal<SecurityItem[]>([]);
  overallStatus = signal<{ level: string; color: string; percentage: number } | null>(null);

  // ── MY DEVICE (most recent phone) ─────────
  myPhone = signal<UserDevice | null>(null);
  phonesLoaded = signal(false);

  // ── LAST LOCATION (sent by the phone) ─────
  lastLocation = signal<LastLocation | null>(null);
  isRefreshing = signal(false);
  locationNotice = signal<string | null>(null);

  // ── ALERTAS ───────────────────────────────────────
  lastEmergency = signal<LastEmergency | null>(null);
  loadedAlerts = signal(false);

  quickAccess: QuickAccess[] = [
    { icon: 'ti-alert-triangle', label: 'Mis emergencias', sub: 'Ver historial',    route: '/dashboard/alert-history' },
    { icon: 'ti-folder',         label: 'Evidencias',      sub: 'Ver mis archivos', route: '/dashboard/evidence' },
    { icon: 'ti-users',          label: 'Contactos',       sub: 'Gestionar',        route: '/dashboard/emergency-contacts' },
    { icon: 'ti-map-pin',        label: 'Ubicación',       sub: 'Ver mapa',         route: '/dashboard/ubicacion' },
    { icon: 'ti-lifebuoy',       label: 'Asistencia',      sub: 'Recursos y ayuda', route: '/dashboard/assistance' },
  ];

  ngOnInit(): void {
    this.loadSecurityStatus();
    this.loadPhone();
    this.loadLastEmergency();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initMiniMap();
      this.loadLastLocation();
      this.loadDangerZones();
    }, 100);
  }

  /** Security status computed with the real account and phone data */
  private loadSecurityStatus(): void {
    this.isLoadingStatus.set(true);
    this.securityStatusService.getSecurityStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status: SecurityStatus) => {
          this.securityStatus.set(status.requirements.map(req => ({
            icon: req.icon,
            value: req.value,
            description: req.label,
            configured: req.met,
            tooltip: req.met ? `${req.label}: ${req.value}` : `${req.label}: ${req.value} (requiere atención)`,
          })));
          const levelTexts: Record<SecurityLevel, string> = {
            seguro: 'Tu cuenta está protegida',
            advertencia: 'Requiere atención',
            critico: 'Configuración incompleta',
          };
          this.overallStatus.set({ level: levelTexts[status.level], color: status.color, percentage: status.percentage });
          this.isLoadingStatus.set(false);
        },
        error: () => {
          this.securityStatus.set([]);
          this.overallStatus.set({ level: 'No se pudo consultar', color: 'rojo', percentage: 0 });
          this.isLoadingStatus.set(false);
        },
      });
  }

  private loadPhone(): void {
    this.deviceService.getMyDevices()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (phones) => {
          const newest = [...phones].sort((a, b) =>
            (b.lastAccess ?? '').localeCompare(a.lastAccess ?? ''))[0] ?? null;
          this.myPhone.set(newest);
          this.phonesLoaded.set(true);
        },
        error: () => this.phonesLoaded.set(true),
      });
  }

  phoneName(d: UserDevice): string {
    return [d.brand, d.model].filter(Boolean).join(' ') || 'Celular';
  }

  lastConnection(d: UserDevice): string {
    if (!d.lastAccess) return 'Sin registro';
    const f = new Date(d.lastAccess);
    return `${f.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}, ${shortTime(f)}`;
  }

  private loadLastEmergency(): void {
    this.alertsService.getMine()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (alerts) => {
          this.loadedAlerts.set(true);
          const a = alerts[0];
          if (!a) return;
          this.lastEmergency.set(this.toEmergency(a));
          this.alertsService.countNotifiedContacts(a.id).subscribe({
            next: (n) => this.lastEmergency.update(e => e && { ...e, notifiedContacts: n }),
            error: () => {},
          });
        },
        error: () => this.loadedAlerts.set(true),
      });
  }

  private toEmergency(a: Alert): LastEmergency {
    const start = new Date(a.started_at ?? a.created_at ?? Date.now());
    return {
      id: a.id,
      date: longDate(start),
      time: shortTime(start),
      location: a.location || 'Sin ubicación',
      activatedBy: a.activationMethod,
      notifiedContacts: null,
      status: a.status,
    };
  }

  // ── Phone location ─────────────────────────

  private loadLastLocation(): void {
    this.phoneLocation.getLatest()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (loc) => this.showLocation(loc), error: () => {} });
  }

  private showLocation(loc: LocationEntry | null): void {
    if (!loc) return;
    const date = loc.recordedAt ? new Date(loc.recordedAt) : null;
    this.lastLocation.set({
      lat: loc.lat,
      lng: loc.lng,
      address: 'Buscando dirección…',
      date: date ? `${date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}, ${shortTime(date)}` : loc.time,
      coordinates: `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`,
      precision: loc.accuracy ? `±${Math.round(loc.accuracy)} metros` : 'Sin dato',
    });
    this.geocoding.get(loc.lat, loc.lng).then((place) => {
      const text = place ? [place.address, place.neighborhood, place.city].filter(Boolean).join(', ') : '';
      this.lastLocation.update(u => u && { ...u, address: text || 'Dirección no disponible' });
      this.updateMarker();
    });
    this.updateMarker();
    this.computeDistances();
  }

  /**
   * Asks the phone for its current location (silent push) and waits up to 20 s for the new point.
   * If it does not answer, the last one it sent stays.
   */
  refreshLocation(): void {
    if (this.isRefreshing()) return;
    this.isRefreshing.set(true);
    this.locationNotice.set(null);
    this.phoneLocation.requestFromPhone().subscribe({
      next: (r) => this.waitForLocation(new Date(r.requestedAt).getTime() - 5000, Date.now() + 20000),
      error: (e) => {
        this.locationNotice.set(e?.error?.message ?? 'No se pudo contactar al celular.');
        this.isRefreshing.set(false);
      },
    });
  }

  private waitForLocation(from: number, limit: number): void {
    this.phoneLocation.getLatest().subscribe({
      next: (loc) => {
        const newOne = !!loc?.recordedAt && new Date(loc.recordedAt).getTime() >= from;
        if (newOne || Date.now() >= limit) {
          if (!newOne) this.locationNotice.set('El celular no respondió. Se muestra la última ubicación que envió.');
          this.showLocation(loc);
          this.isRefreshing.set(false);
          return;
        }
        setTimeout(() => this.waitForLocation(from, limit), 2500);
      },
      error: () => this.isRefreshing.set(false),
    });
  }

  // ── Mapa ──────────────────────────────────────────

  private initMiniMap(): void {
    this.map = L.map('home-mini-map', {
      center: DEFAULT_CENTER,
      zoom: 13,
      zoomControl: true,
      // The mouse wheel scrolls the page; the map zooms with the + and - buttons
      scrollWheelZoom: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);
  }

  private updateMarker(): void {
    const u = this.lastLocation();
    if (!this.map || !u) return;
    const popup = `
      <div style="text-align: center; min-width: 200px;">
        <strong style="color: #6d28d9; font-size: 14px;">📍 Mi celular</strong><br>
        <span style="font-size: 12px; color: #666;">${u.address}</span><br>
        <small style="color: #999;">${u.date}</small>
      </div>`;
    if (this.userMarker) {
      this.userMarker.setLatLng([u.lat, u.lng]).setPopupContent(popup);
    } else {
      this.userMarker = L.marker([u.lat, u.lng], { icon: this.phoneIcon() }).addTo(this.map).bindPopup(popup);
    }
    this.map.setView([u.lat, u.lng], 16);
  }

  /** Takes the map to the last phone location and opens its information. */
  centerOnPhone(): void {
    const u = this.lastLocation();
    if (!this.map || !u) return;
    this.map.flyTo([u.lat, u.lng], 17, { duration: 0.8 });
    this.userMarker?.openPopup();
  }

  private phoneIcon(): L.DivIcon {
    return L.divIcon({
      className: '',
      html: `
        <svg width="36" height="50" viewBox="0 0 36 50" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3));">
          <defs>
            <linearGradient id="gradientPin" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#a855f7" />
              <stop offset="100%" style="stop-color:#6d28d9" />
            </linearGradient>
          </defs>
          <path d="M18 0 C8 0 0 8 0 18 C0 28 18 50 18 50 C18 50 36 28 36 18 C36 8 28 0 18 0 Z" fill="url(#gradientPin)" stroke="white" stroke-width="2"/>
          <circle cx="18" cy="18" r="8" fill="white"/>
          <circle cx="18" cy="18" r="4" fill="#6d28d9"/>
        </svg>`,
      iconSize: [36, 50],
      iconAnchor: [18, 50],
      popupAnchor: [0, -50],
    });
  }

  /** Load and show the backend zones (no made-up data: if there are none, the map has no zones) */
  private loadDangerZones(): void {
    if (!this.map) return;

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;

    this.zoneService.getNearby().subscribe({
      next: (zones) => {
        this.zones = zones;
        this.drawZonesOnMap();
      },
      error: (err) => {
        console.error('Error al cargar zonas:', err);
        this.zones = [];
        this.drawZonesOnMap();
      }
    });
  }

  /** Draw zones on the map with colors by type */
  private drawZonesOnMap(): void {
    if (!this.map) return;

    // Limpiar zonas anteriores
    this.zoneCircles.forEach(circle => circle.remove());
    this.zoneCircles = [];
    this.zoneMarkers.forEach(marker => marker.remove());
    this.zoneMarkers = [];

    this.zones.forEach(zone => {
      if (!this.map) return;

      const config = this.getZoneConfig(zone.type);
      
      // If it has a radius, draw a circle
      if (zone.radiusMeters) {
        const circle = L.circle([zone.lat, zone.lng], {
          radius: zone.radiusMeters,
          color: config.borderColor,
          fillColor: config.fillColor,
          fillOpacity: 0.25,
          weight: 2,
        }).addTo(this.map);

        circle.bindPopup(`
          <div style="min-width: 180px;">
            <strong style="color: ${config.borderColor};">${config.emoji} ${zone.name}</strong><br>
            <span style="font-size: 12px; color: #666;">${config.label}</span><br>
            ${zone.description ? `<p style="font-size: 11px; margin: 5px 0; color: #888;">${zone.description}</p>` : ''}
            ${zone.address ? `<small style="color: #999;">📍 ${zone.address}</small>` : ''}
          </div>
        `);

        this.zoneCircles.push(circle);
      }

      // Same emoji marker as the other maps (core/utils/icono-zona)
      const icon = zoneIcon(zone.type, config.fillColor);

      const marker = L.marker([zone.lat, zone.lng], { icon })
        .addTo(this.map)
        .bindPopup(`
          <div style="min-width: 180px;">
            <strong style="color: ${config.borderColor};">${config.emoji} ${zone.name}</strong><br>
            <span style="font-size: 12px; color: #666;">${config.label}</span><br>
            ${zone.description ? `<p style="font-size: 11px; margin: 5px 0; color: #888;">${zone.description}</p>` : ''}
            ${zone.address ? `<small style="color: #999;">📍 ${zone.address}</small><br>` : ''}
            ${zone.distanceKm ? `<small style="color: #999;">📏 ${zone.distanceKm.toFixed(2)} km de distancia</small>` : ''}
          </div>
        `);

      this.zoneMarkers.push(marker);
    });

    // Compute distances from the user location
    this.computeDistances();
  }

  /** Compute zone distances from the last phone location */
  private computeDistances(): void {
    const u = this.lastLocation();
    if (!u) return;
    this.zones = this.zones.map(zone => ({
      ...zone,
      distanceKm: this.computeDistanceKm(u.lat, u.lng, zone.lat, zone.lng)
    })).sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
  }

  /** Compute the distance between two points in km (Haversine formula) */
  private computeDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /** Get the color and icon configuration by zone type */
  private getZoneConfig(type: NearbyZone['type']): { 
    fillColor: string; 
    borderColor: string; 
    label: string; 
    emoji: string;
  } {
    const configs: Record<NearbyZone['type'], { fillColor: string; borderColor: string; label: string; emoji: string }> = {
      risk: { 
        fillColor: '#cb1ce6', 
        borderColor: '#8f12a2', 
        label: 'Zona de riesgo', 
        emoji: '⚠️' 
      },
      safe: { 
        fillColor: '#5316a3', 
        borderColor: '#431580', 
        label: 'Zona segura', 
        emoji: '🛡️' 
      },
      help: { 
        fillColor: '#500ee9', 
        borderColor: '#3d02c7', 
        label: 'Punto de ayuda', 
        emoji: '🆘' 
      },
      policia: { 
        fillColor: '#9333ea', 
        borderColor: '#7e22ce', 
        label: 'Estación de policía', 
        emoji: '👮' 
      },
      asistencia: { 
        fillColor: '#733bf6', 
        borderColor: '#6025eb', 
        label: 'Centro de asistencia', 
        emoji: '🏥' 
      },
    };

    return configs[type] || configs.risk;
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
