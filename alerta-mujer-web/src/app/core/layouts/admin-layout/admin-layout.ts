import { Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SidebarComponent, SidebarLink, SidebarUser } from '../../../shared/layouts/sidebar/sidebar';
import { TopbarComponent } from '../../../shared/layouts/tobber/topbar';
import { AuthService } from '../../../core/auth/auth.service';

const THEME_STORAGE_KEY = 'alerta_theme';
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
    { label: 'Gestion  Contactos de Emergencia', route: '/admin/emergency-management'},
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

    // Restaura el tema guardado, igual que debería hacer el resto de la app
    const temaGuardado = localStorage.getItem(THEME_STORAGE_KEY);
    if (temaGuardado === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

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
    //  Antes esto hacía document.body.classList.toggle('dark-mode'),
    // pero TODO el CSS de modo oscuro de la app (sidebar, topbar, ah-*, ec-*, ev-*, etc.)
    // usa el selector [data-theme="dark"] en <html>. Esa clase nunca coincidía con nada,
    // así que el modo oscuro del panel de admin probablemente no aplicaba ningún estilo.
    const esOscuro = document.documentElement.getAttribute('data-theme') === 'dark';
    if (esOscuro) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    }
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}