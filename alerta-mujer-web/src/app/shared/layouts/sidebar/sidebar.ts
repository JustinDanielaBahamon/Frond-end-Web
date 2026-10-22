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

  @Input() brandName: string = 'Alerta Mujer';
  @Input() brandTagline: string = 'Tu seguridad, siempre';
  @Input() brandLogo: string = '/logo.png'; // ⚠️ confirm the real file name

  @Input() showMobileAppButton: boolean = false;
  @Input() mobileAppUrl: string = '';

  @Input() user: SidebarUser | null = null;
  /** If given, the name below opens this route (e.g. My profile). */
  @Input() profileRoute: string | null = null;
  @Output() logout = new EventEmitter<void>();
}