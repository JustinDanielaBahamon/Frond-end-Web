import { Component, DestroyRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { of, timer } from 'rxjs';
import { catchError, filter, switchMap } from 'rxjs/operators';
import { SidebarComponent, SidebarLink, SidebarUser } from '../../../shared/layouts/sidebar/sidebar';
import { TopbarAccountLink, TopbarComponent, TopbarNotification } from '../../../shared/layouts/topbar/topbar';
import { AuthService } from '../../../core/auth/auth.service';
import { InactivityService } from '../../../core/auth/inactivity.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { AlertsService } from '../../../core/services/alerts.services';

// Must match the drawer breakpoint in sidebar.scss
const DRAWER_BREAKPOINT = 1024;

// How often new alerts are checked (milliseconds)
const NOTIF_REFRESH_MS = 30000;

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss'
})
export class AdminLayoutComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private themeService = inject(ThemeService);
  private alertsService = inject(AlertsService);
  private inactivity = inject(InactivityService);

  // On narrow screens the sidebar is a drawer and starts closed
  private isDrawerMode = window.innerWidth <= DRAWER_BREAKPOINT;
  sidebarCollapsed = this.isDrawerMode;
  currentUser: SidebarUser | null = null;

  // Notificaciones del topbar (alertas pendientes)
  // Signal: the app does not use zone.js, so the bell only updates if the list reports the change.
  notifications = signal<TopbarNotification[]>([]);

  links: SidebarLink[] = [
    { label: 'Dashboard',    route: '/admin/dashboard', exact: true },
    { label: 'Gestión de usuarios', route: '/admin/usuarios' },
    { label: 'Gestión de alertas', route: '/admin/alertas' },
    { label: 'Zonas y puntos de ayuda', route: '/admin/zone-management' },
    { label: 'Informes', route: '/admin/report-management' },
    { label: 'Gestión de evidencias', route: '/admin/evidence-management' },
    { label: 'Moderación', route: '/admin/moderator-management' },
    { label: 'Gestión de dispositivos', route: '/admin/devices-management' },
    { label: 'Auditoría', route: '/admin/auditoria' },
    { label: 'Configuración', route: '/admin/settings' },
    { label: 'Mi perfil', route: '/admin/perfil' },
  ];

  // Account menu links (top right), besides "Mi perfil"
  readonly accountLinks: TopbarAccountLink[] = [
    { label: 'Cambiar contraseña', route: '/admin/perfil', fragment: 'contrasena', icon: 'fa-solid fa-key' },
    { label: 'Configuración del sistema', route: '/admin/settings', icon: 'fa-solid fa-sliders' },
    { label: 'Auditoría', route: '/admin/auditoria', icon: 'fa-solid fa-clock-rotate-left' },
  ];

  ngOnInit() {
    // Sign-out due to inactivity, only while inside the panel
    this.inactivity.start();
    this.destroyRef.onDestroy(() => this.inactivity.stop());

    // Profile shown at the bottom of the sidebar (the [user] was missing before, that is why it did not show)
    this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user
        ? { name: user.name, email: user.email }
        : null;
    });

    // In drawer mode, closes the menu when navigating to another module
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

    // Notificaciones: alertas pendientes, se refrescan cada 30 segundos.
    // If a query fails, the existing notifications are kept.
    timer(0, NOTIF_REFRESH_MS)
      .pipe(
        switchMap(() => this.alertsService.getAll().pipe(catchError(() => of(null)))),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((alerts) => {
        if (!alerts) return;

        this.notifications.set(alerts
          .filter((a) => a.status === 'Pendiente')
          .sort((a, b) => Number(b.id) - Number(a.id))
          .slice(0, 20)
          .map((a) => ({
            id: a.id,
            title: `Alerta pendiente — ${a.activationMethod}`,
            message: a.location ? `${a.name} · ${a.location}` : a.name,
            time: a.time,
            route: '/admin/alertas',
          })));
      });
  }

  // When crossing the breakpoint: closed on narrow screens, open on desktop
  @HostListener('window:resize')
  onResize() {
    const drawerMode = window.innerWidth <= DRAWER_BREAKPOINT;
    if (drawerMode !== this.isDrawerMode) {
      this.isDrawerMode = drawerMode;
      this.sidebarCollapsed = drawerMode;
    }
  }

  signOut() {
    this.authService.logout();
  }

  toggleTheme() {
    // Single source of truth for the theme: ThemeService. That way AccentColorService
    // recomputes the palette (--purple-pale, --purple-deep, etc.) when it changes.
    this.themeService.toggleTheme();
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}