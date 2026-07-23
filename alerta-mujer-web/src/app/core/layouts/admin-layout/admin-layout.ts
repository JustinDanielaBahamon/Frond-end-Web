import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SidebarComponent, SidebarLink } from '../../../shared/layouts/sidebar/sidebar';
import { TopbarComponent } from '../../../shared/layouts/tobber/topbar';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss'
})
export class AdminLayoutComponent {
  sidebarCollapsed = false;

  links: SidebarLink[] = [
    { label: 'Dashboard',    route: '/admin/dashboard', exact: true },
    { label: 'Usuarios',     route: '/admin/usuarios' },
    { label: 'Alertas',      route: '/admin/alertas' },
    { label: 'Gestion de Zonas', route: '/admin/zone-management' },
    { label: 'Gestion de Reportes', route: '/admin/report-management' },
    { label: 'Gestion  Contactos de Emergencia', route: '/admin/emergency-management'},
    { label: 'Gestion de evidencias' , route:'/admin/evidence-management'},
  ];

  toggleTheme() {
    document.body.classList.toggle('dark-mode');
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}