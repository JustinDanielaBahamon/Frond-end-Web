import { Component, inject } from '@angular/core';
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
export class DashboardLayoutComponent {
  private themeService = inject(ThemeService);
  private authService = inject(AuthService);

  sidebarCollapsed = false;

  links: SidebarLink[] = [
    { label: 'Inicio',                 route: '/dashboard',                    icon: 'fa-solid fa-house',       exact: true },
    { label: 'Mis emergencias',        route: '/dashboard/alert-history',      icon: 'fa-solid fa-triangle-exclamation' },
    { label: 'Ubicación',              route: '/dashboard/ubicacion',          icon: 'fa-solid fa-location-dot' },
    { label: 'Evidencias',             route: '/dashboard/evidence',           icon: 'fa-solid fa-folder-open' },
    { label: 'Contactos de emergencia', route: '/dashboard/emergency-contacts', icon: 'fa-solid fa-users' },
    { label: 'Asistencia',             route: '/dashboard/assistance',         icon: 'fa-solid fa-headset' },
    { label: 'Configuración',          route: '/dashboard/settings',           icon: 'fa-solid fa-gear' },
  ];

  // Usuario real de la sesión
  user = {
    name: '',
    email: ''
  };

  // Solo el primer nombre para el saludo del topbar
  primerNombre = '';
  avatarLetra = 'U';

  ngOnInit() {
    this.authService.currentUser$.subscribe(usuario => {
      if (!usuario) return;
      const nombreCompleto = usuario.nombre?.trim() || usuario.firstName || '';
      this.primerNombre = (usuario.firstName || usuario.nombre || '').trim().split(/\s+/)[0] || '';
      this.user = {
        name: nombreCompleto,
        email: usuario.email ?? ''
      };
      this.avatarLetra = this.primerNombre
        ? this.primerNombre.charAt(0).toUpperCase()
        : 'U';
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