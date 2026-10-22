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

export interface TopbarAccountLink {
  label: string;
  route: string;
  /** Clase de Font Awesome, p. ej. 'fa-solid fa-key' */
  icon: string;
  fragment?: string;
}

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
  // TODO: pass it from the layout (dashboard-layout.ts) with the real name of the signed-in user
  @Input() userName: string = 'Usuario';
  // TODO: pass it from each page, or generate it with router.data['title'] on NavigationEnd
  @Input() pageTitle: string = '';
  // List of notifications each layout passes. If nothing is passed, the panel is empty.
  @Input() notifications: TopbarNotification[] = [];

  /** Account menu (top right). Only shown if there is a profileRoute. */
  @Input() userEmail: string = '';
  @Input() userRole: string = '';
  @Input() profileRoute: string | null = null;
  @Input() accountLinks: TopbarAccountLink[] = [];
  @Output() sidebarToggle = new EventEmitter<void>();
  @Output() themeToggle = new EventEmitter<void>();

  private authService = inject(AuthService);
  private router = inject(Router);
  settings = inject(SettingsService);
  private themeService = inject(ThemeService);

  // the moon/sun icon follows the real theme, not a local boolean
  get isDark(): boolean {
    return this.themeService.currentTheme() === 'dark';
  }

  // Language menu
  menuOpen = false;

  // Account menu
  accountOpen = false;

  get initials(): string {
    return (this.userName || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  }

  toggleAccount() {
    this.accountOpen = !this.accountOpen;
    if (this.accountOpen) {
      this.menuOpen = false;
      this.notifOpen = false;
    }
  }

  closeAccount() {
    this.accountOpen = false;
  }

  // Panel de notificaciones
  notifOpen = false;
  private readIds = new Set<string>(this.loadRead());

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
    if (this.menuOpen) {
      this.notifOpen = false;
      this.accountOpen = false;
    }
  }

  closeMenu() {
    this.menuOpen = false;
  }

  setLanguage(lang: AppLanguage) {
    this.settings.setLanguage(lang);
  }

  logout() {
    this.closeMenu();
    this.closeAccount();
    this.authService.logout();
  }

  // ── Notificaciones ───────────────────────────
  toggleNotif() {
    this.notifOpen = !this.notifOpen;
    if (this.notifOpen) {
      this.menuOpen = false;
      this.accountOpen = false;
    }
  }

  closeNotif() {
    this.notifOpen = false;
  }

  isRead(n: TopbarNotification): boolean {
    return this.readIds.has(String(n.id));
  }

  markAllRead() {
    this.notifications.forEach((n) => this.readIds.add(String(n.id)));
    this.saveRead();
  }

  onNotificationClick(n: TopbarNotification) {
    this.readIds.add(String(n.id));
    this.saveRead();
    this.closeNotif();
    if (n.route) {
      this.router.navigateByUrl(n.route);
    }
  }

  private loadRead(): string[] {
    try {
      const raw = localStorage.getItem(READ_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveRead(): void {
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(Array.from(this.readIds)));
    } catch {
      /* if localStorage fails, the read ones are simply not remembered */
    }
  }
}