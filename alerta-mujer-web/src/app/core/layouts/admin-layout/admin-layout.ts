import { Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SidebarComponent, SidebarLink, SidebarUser } from '../../../shared/layouts/sidebar/sidebar';
import { TopbarComponent } from '../../../shared/layouts/tobber/topbar';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/theme/theme.service';

// Debe coincidir con el breakpoint del drawer en sidebar.scss
const DRAWER_BREAKPOINT = 1024;

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

  // En pantallas angostas el sidebar es un drawer y empieza cerrado
  private isDrawerMode = window.innerWidth <= DRAWER_BREAKPOINT;
  sidebarCollapsed = this.isDrawerMode;
  usuarioActual: SidebarUser | null = null;

  links: SidebarLink[] = [
    { label: 'Dashboard',    route: '/admin/dashboard', exact: true },
    { label: 'Usuarios',     route: '/admin/usuarios' },
    { label: 'Alertas',      route: '/admin/alertas' },
    { label: 'Gestion de Zonas', route: '/admin/zone-management' },
    { label: 'Gestion de Reportes', route: '/admin/report-management' },
    { label: 'Gestion de evidencias' , route:'/admin/evidence-management'},
    { label: 'Gestion de Moderadores' , route:'/admin/moderator-management'},
    { label: 'Gestion de Dispositivos', route: '/admin/devices-management'},
  ];

  ngOnInit() {
    // Perfil que se muestra abajo del sidebar (antes faltaba el [user], por eso no aparecía)
    this.authService.currentUser$.subscribe((usuario) => {
      this.usuarioActual = usuario
        ? { name: usuario.nombre, email: usuario.email }
        : null;
    });

    // En modo drawer, cierra el menú al navegar a otro módulo
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
  }

  // Al cruzar el breakpoint: cerrado en pantallas angostas, abierto en escritorio
  @HostListener('window:resize')
  onResize() {
    const drawerMode = window.innerWidth <= DRAWER_BREAKPOINT;
    if (drawerMode !== this.isDrawerMode) {
      this.isDrawerMode = drawerMode;
      this.sidebarCollapsed = drawerMode;
    }
  }

  cerrarSesion() {
    this.authService.logout();
  }

  toggleTheme() {
    // Único punto de verdad del tema: ThemeService. Así AccentColorService
    // recalcula la paleta (--purple-pale, --purple-deep, etc.) al cambiar.
    this.themeService.toggleTheme();
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}