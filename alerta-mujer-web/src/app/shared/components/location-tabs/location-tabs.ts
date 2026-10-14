import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export type LocationTabIcon =
  | 'location'
  | 'clock'
  | 'star'
  | 'shield'
  | 'map-pin'
  | 'bookmark'
  | 'alert-triangle'
  | 'route'
  | 'history';

export interface LocationTab {
  label: string;
  path: string;
  icon: LocationTabIcon;
}

@Component({
  selector: 'app-location-tabs',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './location-tabs.html',
  styleUrl: './location-tabs.scss'
})
export class LocationTabsComponent {
  @Input() title = 'Ubicación';
  @Input() subtitle = 'Consulta tu ubicación, lugares guardados y zonas de auxilio.';

  tabs: LocationTab[] = [
    { label: 'Mi ubicación',          path: '/dashboard/ubicacion/my-location',            icon: 'location' },
    { label: 'Ubicaciones guardadas', path: '/dashboard/ubicacion/ubicaciones-guardadas', icon: 'bookmark' },
    { label: 'Zonas auxiliares',      path: '/dashboard/ubicacion/zonas-auxiliares',      icon: 'alert-triangle' },
    { label: 'Guardar recorrido',     path: '/dashboard/ubicacion/guardar-recorrido',     icon: 'route' },
  ];
}
