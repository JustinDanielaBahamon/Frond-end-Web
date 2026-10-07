import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { SettingsService, AppLanguage } from '../../../core/settings/settings.service';
import { ThemeService } from '../../../core/theme/theme.service';

export interface TopbarNotification {
  id: number | string;
  title: string;
  message: string;
  time: string;
  route?: string;
}

const READ_KEY = 'alerta-mujer-notif-read';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss'
})
export class TopbarComponent {
  @Input() brand: string = 'Alerta Mujer';
  @Input() avatarLetter: string = 'U';
  // Se enlaza desde dashboard-layout.html con el primer nombre real del usuario logueado
  @Input() userName: string = 'Usuario';
  // TODO: pásalo desde cada página, o autogénéralo con router.data['title'] en NavigationEnd
  @Input() pageTitle: string = '';
  // Lista de notificaciones que le pasa cada layout. Si no pasa nada, el panel sale vacío.
  @Input() notifications: TopbarNotification[] = [];
  @Output() sidebarToggle = new EventEmitter<void>();
  @Output() themeToggle = new EventEmitter<void>();

  private authService = inject(AuthService);
  private router = inject(Router);
  settings = inject(SettingsService);
  private themeService = inject(ThemeService);

  // el icono de luna/sol sigue el tema real, no un booleano local
  get isDark(): boolean {
    return this.themeService.currentTheme() === 'dark';
  }

  // Menú de idioma
  menuOpen = false;

  // Panel de notificaciones
  notifOpen = false;
  private readIds = new Set<string>(this.cargarLeidas());

  get unreadCount(): number {
    return this.notifications.filter((n) => !this.readIds.has(String(n.id))).length;
  }

  onToggleSidebar() {
    this.sidebarToggle.emit();
  }

  onToggleTheme() {
    this.themeToggle.emit();
  }

  // ── Idioma ───────────────────────────────────
  toggleMenu() {
    this.menuOpen = !this.menuOpen;
    if (this.menuOpen) this.notifOpen = false;
  }

  closeMenu() {
    this.menuOpen = false;
  }

  setLanguage(lang: AppLanguage) {
    this.settings.setLanguage(lang);
  }

  logout() {
    this.closeMenu();
    this.authService.logout();
  }

  // ── Notificaciones ───────────────────────────
  toggleNotif() {
    this.notifOpen = !this.notifOpen;
    if (this.notifOpen) this.menuOpen = false;
  }

  closeNotif() {
    this.notifOpen = false;
  }

  isRead(n: TopbarNotification): boolean {
    return this.readIds.has(String(n.id));
  }

  markAllRead() {
    this.notifications.forEach((n) => this.readIds.add(String(n.id)));
    this.guardarLeidas();
  }

  onNotificationClick(n: TopbarNotification) {
    this.readIds.add(String(n.id));
    this.guardarLeidas();
    this.closeNotif();
    if (n.route) {
      this.router.navigateByUrl(n.route);
    }
  }

  private cargarLeidas(): string[] {
    try {
      const raw = localStorage.getItem(READ_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private guardarLeidas(): void {
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(Array.from(this.readIds)));
    } catch {
      /* si localStorage falla, simplemente no se recuerdan las leídas */
    }
  }
}