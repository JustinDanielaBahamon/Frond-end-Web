import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss'
})
export class TopbarComponent {
  @Input() brand: string = 'Alerta Mujer';
  @Input() avatarLetter: string = 'U';
  @Output() sidebarToggle = new EventEmitter<void>();
  @Output() themeToggle = new EventEmitter<void>();

  isDark = false;

  onToggleSidebar() {
    this.sidebarToggle.emit();
  }

  onToggleTheme() {
    this.isDark = !this.isDark;
    this.themeToggle.emit();
  }
}