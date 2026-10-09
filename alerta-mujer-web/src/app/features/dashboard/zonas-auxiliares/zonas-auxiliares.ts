import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NearbyZoneService } from '../../../core/services/nearby-zone.service';
import { AuthService } from '../../../core/auth/auth.service';
import { NearbyZone } from '../../../core/models/nearby-zone.model';

type ZonaTipo = 'segura' | 'riesgo' | 'asistencia' | 'policia';

interface ZonaAuxiliar {
  id: string;
  nombre: string;
  tipo: ZonaTipo;
  coordenada: {
    latitude: number;
    longitude: number;
  };
  direccion: string;
  distancia?: number;
}

@Component({
  selector: 'app-zonas-auxiliares',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './zonas-auxiliares.html',
  styleUrl: './zonas-auxiliares.scss'
})
export class ZonasAuxiliaresComponent implements OnInit {
  private zoneService = inject(NearbyZoneService);
  private authService = inject(AuthService);

  zonasAuxiliares = signal<ZonaAuxiliar[]>([]);
  selectedZone = signal<ZonaAuxiliar | null>(null);
  loading = signal(true);
  error = signal('');

  ngOnInit() {
    this.authService.currentUser$.subscribe((user: any) => {
      this.cargarZonas();
    });
  }

  cargarZonas() {
    this.loading.set(true);
    this.error.set('');

    this.zoneService.getByUser(0).subscribe({
      next: (zones) => {
        const mapeadas: ZonaAuxiliar[] = zones
          .filter((z) => z.isActive !== false && z.lat != null && z.lng != null)
          .map((z) => ({
            id: String(z.id),
            nombre: z.name,
            tipo: this.mapearTipoZona(z.type, z.riskLevel),
            coordenada: { latitude: z.lat, longitude: z.lng },
            direccion: z.address ? `${z.address}${z.city ? ', ' + z.city : ''}` : (z.city ?? ''),
          }));
        this.zonasAuxiliares.set(mapeadas);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Error al cargar zonas. Por favor intenta nuevamente.');
        this.loading.set(false);
        console.error('Error al cargar zonas:', err);
      }
    });
  }

  mapearTipoZona(zoneType?: string, riskLevel?: string): ZonaTipo {
    const zt = (zoneType || '').toLowerCase();
    if (zt.includes('polic')) return 'policia';
    if (zt.includes('asist')) return 'asistencia';
    if (zt === 'safe' || zt.includes('segura')) return 'segura';
    if (zt === 'risk' || zt.includes('riesgo')) return 'riesgo';
    const rl = (riskLevel || '').toLowerCase();
    if (rl === 'high' || rl === 'alto') return 'riesgo';
    if (rl === 'low' || rl === 'bajo') return 'segura';
    return 'riesgo';
  }

  getZoneColor = (tipo: ZonaTipo) => {
    switch (tipo) {
      case 'segura':
        return '#27AE60';
      case 'riesgo':
        return '#E74C3C';
      case 'asistencia':
        return '#3498DB';
      case 'policia':
        return '#9B59B6';
      default:
        return '#7B1DB2';
    }
  };

  getZoneIcon = (tipo: ZonaTipo) => {
    switch (tipo) {
      case 'segura':
        return 'ti ti-shield-check';
      case 'riesgo':
        return 'ti ti-alert-triangle';
      case 'asistencia':
        return 'ti ti-heart-pulse';
      case 'policia':
        return 'ti ti-shield-police';
      default:
        return 'ti ti-map-pin';
    }
  };

  getZoneLabel = (tipo: ZonaTipo) => {
    switch (tipo) {
      case 'segura':
        return 'Zona segura';
      case 'riesgo':
        return 'Zona de riesgo';
      case 'asistencia':
        return 'Punto de asistencia';
      case 'policia':
        return 'Policía';
      default:
        return 'Otra';
    }
  };
}
