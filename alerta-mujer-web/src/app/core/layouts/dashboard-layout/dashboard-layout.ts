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
    { label: 'Dashboard',              route: '/dashboard',               icon: 'fa-solid fa-house',       exact: true },
    { label: 'Ubicación del teléfono', route: '/dashboard/phone-location', icon: 'fa-solid fa-location-dot' },
    { label: 'Historial de Alerta',    route: '/dashboard/alert-history',  icon: 'fa-solid fa-bell' },
    { label: 'Evidencias',             route: '/dashboard/evidence',       icon: 'fa-solid fa-folder-open' },
  ];

  // ⚠️ reemplaza por el usuario real cuando AuthService lo exponga
  user = {
    name: 'María González',
    email: 'maria.gonzalez@email.com'
  };

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