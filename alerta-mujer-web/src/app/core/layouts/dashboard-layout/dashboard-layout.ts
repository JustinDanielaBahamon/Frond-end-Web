import { Component, inject, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SidebarComponent, SidebarLink } from '../../../shared/layouts/sidebar/sidebar';
import { TopbarComponent } from '../../../shared/layouts/tobber/topbar';
import { ThemeService } from '../../../core/theme/theme.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.scss'
})
export class DashboardLayoutComponent implements OnInit {
  private themeService = inject(ThemeService);
  private authService = inject(AuthService);

  sidebarCollapsed = false;

  links: SidebarLink[] = [
    { label: 'Inicio',                 route: '/dashboard',                    icon: 'fa-solid fa-house',       exact: true },
    { label: 'Mis emergencias',        route: '/dashboard/alert-history',      icon: 'fa-solid fa-triangle-exclamation' },
    { label: 'Ubicación',              route: '/dashboard/ubicacion',          icon: 'fa-solid fa-location-dot' },
    { label: 'Guardar ubicación',      route: '/dashboard/guardar-ubicacion',  icon: 'fa-solid fa-map-location' },
    { label: 'Ubicaciones guardadas',  route: '/dashboard/ubicaciones-guardadas', icon: 'fa-solid fa-folder-tree' },
    { label: 'Evidencias',             route: '/dashboard/evidence',           icon: 'fa-solid fa-folder-open' },
    { label: 'Contactos de emergencia', route: '/dashboard/emergency-contacts', icon: 'fa-solid fa-users' },
    { label: 'Asistencia',             route: '/dashboard/assistance',         icon: 'fa-solid fa-headset' },
    { label: 'Configuración',          route: '/dashboard/settings',           icon: 'fa-solid fa-gear' },
    { label: 'Guardar recorrido',      route: '/dashboard/guardar-recorrido',  icon: 'fa-solid fa-file-lines' },
    { label: 'Historial recorridos',   route: '/dashboard/historial-recorridos', icon: 'fa-solid fa-history' },
  ];

  // Usuario real del AuthService
  user = {
    name: '',
    email: ''
  };

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(currentUser => {
      if (currentUser) {
        this.user = {
          name: currentUser.nombre,
          email: currentUser.email
        };
      }
    });
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  onLogout() {
    this.authService.logout();
  }
}