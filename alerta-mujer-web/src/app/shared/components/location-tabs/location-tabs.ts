import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-location-tabs',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './location-tabs.html',
  styleUrl: './location-tabs.scss'
})
export class LocationTabsComponent {
  @Input() title = 'Ubicación';
  @Input() subtitle = 'Consulta tu ubicación, historial y lugares importantes.';

  tabs = [
    { label: 'Mi ubicación', path: '/dashboard/ubicacion/my-location', icon: 'location' as const },
    { label: 'Historial', path: '/dashboard/ubicacion/history', icon: 'clock' as const },
    { label: 'Lugares frecuentes', path: '/dashboard/ubicacion/frequent-places', icon: 'star' as const },
    { label: 'Zonas cercanas', path: '/dashboard/ubicacion/nearby-zones', icon: 'shield' as const },
    { label: 'Guardar ubicación', path: '/dashboard/ubicacion/guardar-ubicacion', icon: 'map-pin' as const },
    { label: 'Ubicaciones guardadas', path: '/dashboard/ubicacion/ubicaciones-guardadas', icon: 'bookmark' as const },
    { label: 'Zonas auxiliares', path: '/dashboard/ubicacion/zonas-auxiliares', icon: 'alert-triangle' as const },
    { label: 'Guardar recorrido', path: '/dashboard/ubicacion/guardar-recorrido', icon: 'route' as const },
    { label: 'Historial recorridos', path: '/dashboard/ubicacion/historial-recorridos', icon: 'history' as const },
  ];
}
