import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

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
  @Output() sidebarToggle = new EventEmitter<void>();
  @Output() themeToggle = new EventEmitter<void>();

  private authService = inject(AuthService);

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

  logout() {
    this.closeMenu();
    this.authService.logout();
  }
}