import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ReceivedAlertsService } from '../../../core/services/received-alerts.service';
import { SidebarComponent, SidebarLink } from '../../../shared/layouts/sidebar/sidebar';
import { TopbarComponent } from '../../../shared/layouts/topbar/topbar';
import { ThemeService } from '../../../core/theme/theme.service';
import { AuthService } from '../../../core/auth/auth.service';
import { PhoneMovementService } from '../../../core/services/phone-movement.service';
import { APK_DOWNLOAD_URL } from '../../../shared/constants/descarga-app';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, SidebarComponent, TopbarComponent, DatePipe],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.scss'
})
export class DashboardLayoutComponent implements OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private authService = inject(AuthService);
  /** Alerts of the people who have the user as a contact (notice across the whole panel). */
  readonly receivedAlerts = inject(ReceivedAlertsService);
  /** "Your phone changed places" (user only; enabled in Settings). */
  readonly movement = inject(PhoneMovementService);
  /** APK of the latest release (the same link as the landing page). */
  readonly apkDownloadUrl = APK_DOWNLOAD_URL;

  sidebarCollapsed = false;

  links: SidebarLink[] = [
    { label: 'Inicio',                 route: '/dashboard',                    icon: 'fa-solid fa-house',       exact: true },
    { label: 'Mis emergencias',        route: '/dashboard/alert-history',      icon: 'fa-solid fa-triangle-exclamation' },
    { label: 'Alertas de mis contactos', route: '/dashboard/alertas-contactos', icon: 'fa-solid fa-people-group' },
    { label: 'Ubicación',              route: '/dashboard/ubicacion',          icon: 'fa-solid fa-location-dot' },
    { label: 'Evidencias',             route: '/dashboard/evidence',           icon: 'fa-solid fa-folder-open' },
    { label: 'Contactos de emergencia', route: '/dashboard/emergency-contacts', icon: 'fa-solid fa-users' },
    { label: 'Asistencia',             route: '/dashboard/assistance',         icon: 'fa-solid fa-headset' },
    { label: 'Estado del Dispositivo', route: '/dashboard/device',             icon: 'fa-solid fa-microchip' },
    { label: 'Configuración',          route: '/dashboard/settings',           icon: 'fa-solid fa-gear' },
  ];

  // Usuario real del AuthService
  user = {
    name: '',
    email: ''
  };

  ngOnInit(): void {
    this.receivedAlerts.start();
    this.movement.start();
    this.authService.currentUser$.subscribe(currentUser => {
      if (currentUser) {
        this.user = {
          name: currentUser.name,
          email: currentUser.email
        };
      }
    });
  }

  ngOnDestroy(): void {
    this.receivedAlerts.stop();
    this.movement.stop();
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  onLogout() {
    this.receivedAlerts.stop();
    this.movement.stop();
    this.authService.logout();
  }
}