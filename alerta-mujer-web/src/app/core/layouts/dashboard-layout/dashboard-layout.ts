import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SidebarComponent, SidebarLink } from '../../../shared/layouts/sidebar/sidebar';
import { TopbarComponent } from '../../../shared/layouts/topbar/topbar';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.scss'
})
export class DashboardLayoutComponent {
  sidebarCollapsed = false;

  links: SidebarLink[] = [
    { label: 'Dashboard',              route: '/dashboard',               exact: true },
    { label: 'Ubicación del teléfono', route: '/dashboard/phone-location' },
    { label: 'Historial de Alerta',    route: '/dashboard/alert-history'  },
    { label: 'Evidencias',             route: '/dashboard/evidence'       },
  ];

  toggleTheme() {
    document.body.classList.toggle('dark-mode');
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}