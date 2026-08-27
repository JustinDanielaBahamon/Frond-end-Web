import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { SettingsService, AppLanguage, AppFontSize } from '../../../core/settings/settings.service';

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
  // TODO: pásalo desde el layout (dashboard-layout.ts) con el nombre real del usuario logueado
  @Input() userName: string = 'Usuario';
  // TODO: pásalo desde cada página, o autogénéralo con router.data['title'] en NavigationEnd
  @Input() pageTitle: string = '';
  @Output() sidebarToggle = new EventEmitter<void>();
  @Output() themeToggle = new EventEmitter<void>();

  private authService = inject(AuthService);
  settings = inject(SettingsService);

  isDark = false;
  menuOpen = false;

  onToggleSidebar() {
    this.sidebarToggle.emit();
  }

  onToggleTheme() {
    this.isDark = !this.isDark;
    this.themeToggle.emit();
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu() {
    this.menuOpen = false;
  }

  setLanguage(lang: AppLanguage) {
    this.settings.setLanguage(lang);
  }

  setFontSize(size: AppFontSize) {
    this.settings.setFontSize(size);
  }

  logout() {
    this.closeMenu();
    this.authService.logout();
  }
}