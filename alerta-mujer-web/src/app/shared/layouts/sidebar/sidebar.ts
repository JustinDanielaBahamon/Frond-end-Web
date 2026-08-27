import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface SidebarLink {
  label: string;
  route: string;
  icon?: string;
  exact?: boolean;
}

export interface SidebarUser {
  name: string;
  email: string;
  avatarUrl?: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class SidebarComponent {
  @Input() links: SidebarLink[] = [];
  @Input() sectionTitle: string = 'Módulo';
  @Input() collapsed: boolean = false;
  @Input() accentColor: string = '#2d1457';

  @Input() brandName: string = 'Alerta Mujer';
  @Input() brandTagline: string = 'Tu seguridad, siempre';
  @Input() brandLogo: string = '/logo.png'; // ⚠️ confirma el nombre real del archivo

  @Input() showMobileAppButton: boolean = false;
  @Input() mobileAppUrl: string = '';

  @Input() user: SidebarUser | null = null;
  @Output() logout = new EventEmitter<void>();
}