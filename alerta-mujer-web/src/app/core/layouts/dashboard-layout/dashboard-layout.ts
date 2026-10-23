import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ReceivedAlertsService } from '../../../core/services/received-alerts.service';
import { SidebarComponent, SidebarLink } from '../../../shared/layouts/sidebar/sidebar';
import { TopbarComponent } from '../../../shared/layouts/tobber/topbar';
import { ThemeService } from '../../../core/theme/theme.service';
import { AuthService } from '../../../core/auth/auth.service';
import { MovimientoCelularService } from '../../../core/services/movimiento-celular.service';
import { URL_DESCARGA_APK } from '../../../shared/constants/descarga-app';

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
  /** Alertas de las personas que tienen a la usuaria como contacto (aviso en todo el panel). */
  readonly alertasRecibidas = inject(ReceivedAlertsService);
  /** "Tu celular cambió de lugar" (solo para la usuaria; se activa en Configuración). */
  readonly movimiento = inject(MovimientoCelularService);
  /** APK del último release (el mismo enlace de la página de inicio). */
  readonly urlDescargaApk = URL_DESCARGA_APK;

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
    this.alertasRecibidas.iniciar();
    this.movimiento.iniciar();
    this.authService.currentUser$.subscribe(currentUser => {
      if (currentUser) {
        this.user = {
          name: currentUser.nombre,
          email: currentUser.email
        };
      }
    });
  }

  ngOnDestroy(): void {
    this.alertasRecibidas.detener();
    this.movimiento.detener();
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  onLogout() {
    this.alertasRecibidas.detener();
    this.movimiento.detener();
    this.authService.logout();
  }
}