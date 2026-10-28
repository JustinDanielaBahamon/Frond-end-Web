import { TPipe } from '../../i18n/i18n';
import { Component, DestroyRef, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { DatePipe } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ReceivedAlertsService } from '../../../core/services/received-alerts.service';
import { SidebarComponent, SidebarLink } from '../../../shared/layouts/sidebar/sidebar';
import { TopbarComponent } from '../../../shared/layouts/topbar/topbar';
import { ThemeService } from '../../../core/theme/theme.service';
import { AuthService } from '../../../core/auth/auth.service';
import { PhoneMovementService } from '../../../core/services/phone-movement.service';
import { APK_DOWNLOAD_URL } from '../../../shared/constants/descarga-app';

// Igual que en el admin: debe coincidir con el punto de quiebre del drawer en sidebar.scss
const DRAWER_BREAKPOINT = 1024;

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [TPipe, RouterLink, RouterLinkActive, RouterOutlet, SidebarComponent, TopbarComponent, DatePipe],
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

  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  // En pantallas chicas la barra lateral es un menú deslizable (drawer) y empieza cerrada
  private isDrawerMode = window.innerWidth <= DRAWER_BREAKPOINT;
  sidebarCollapsed = this.isDrawerMode;

  links: SidebarLink[] = [
    { label: 'Inicio',                 route: '/dashboard',                    icon: 'fa-solid fa-house',       exact: true, group: 'Mi seguridad' },
    { label: 'Mis emergencias',        route: '/dashboard/alert-history',      icon: 'fa-solid fa-triangle-exclamation' },
    { label: 'Alertas de mis contactos', route: '/dashboard/alertas-contactos', icon: 'fa-solid fa-people-group' },
    { label: 'Ubicación',              route: '/dashboard/ubicacion',          icon: 'fa-solid fa-location-dot', group: 'Protección y apoyo' },
    { label: 'Evidencias',             route: '/dashboard/evidence',           icon: 'fa-solid fa-folder-open' },
    { label: 'Contactos de emergencia', route: '/dashboard/emergency-contacts', icon: 'fa-solid fa-users' },
    { label: 'Asistencia',             route: '/dashboard/assistance',         icon: 'fa-solid fa-headset', group: 'Ayuda y ajustes' },
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

    // En modo drawer, se cierra el menú al entrar a otro módulo (igual que en el admin)
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (this.isDrawerMode) {
          this.sidebarCollapsed = true;
        }
      });

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

  // Al cruzar el punto de quiebre: cerrada en pantallas chicas, abierta en escritorio
  @HostListener('window:resize')
  onResize() {
    const drawerMode = window.innerWidth <= DRAWER_BREAKPOINT;
    if (drawerMode !== this.isDrawerMode) {
      this.isDrawerMode = drawerMode;
      this.sidebarCollapsed = drawerMode;
    }
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