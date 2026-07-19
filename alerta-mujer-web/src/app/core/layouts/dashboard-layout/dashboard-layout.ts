import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SidebarComponent, SidebarLink } from '../../../shared/layouts/sidebar/sidebar';
import { TopbarComponent } from '../../../shared/layouts/tobber/topbar';
import { ThemeService } from '../../../core/theme/theme.service'; // ajusta la ruta si es distinta

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.scss'
})
export class DashboardLayoutComponent {
  private themeService = inject(ThemeService);

  sidebarCollapsed = false;

  links: SidebarLink[] = [
    { label: 'Dashboard',              route: '/dashboard',               exact: true },
    { label: 'Ubicación del teléfono', route: '/dashboard/phone-location' },
    { label: 'Historial de Alerta',    route: '/dashboard/alert-history'  },
    { label: 'Evidencias',             route: '/dashboard/evidence'       },
  ];

  toggleTheme() {
    this.themeService.toggleTheme(); // esto sí pone data-theme="dark"/"light" en <html>
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}