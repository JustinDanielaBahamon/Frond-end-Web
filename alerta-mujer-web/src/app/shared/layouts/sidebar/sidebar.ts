import { Component, Input} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface SidebarLink {
  label: string;
  route: string;
  exact?: boolean;
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
}