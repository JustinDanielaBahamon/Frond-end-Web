import { Component, HostListener, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../../theme/theme.service'; // ajusta la ruta real

@Component({
  selector: 'app-landing-navbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing-navbar.html',
  styleUrl: './landing-navbar.scss',
})
export class LandingNavbarComponent {

  menuOpened = false;
  menuOpendSession = false;
  menuOpneIdioms = false;
  idiomActual = 'ES';
  menuMobileOpen = false;
  menuOpneIdiomsMobile = false;

  constructor(
    private elementRef: ElementRef,
    public themeService: ThemeService   // público para poder usarlo en el HTML
  ) {}

  toggleMenu() {
    this.menuOpened = !this.menuOpened;
  }

  toggleSessionMenu() {
    this.menuOpendSession = !this.menuOpendSession;
  }

  toggleIdiomsMenu() {
    this.menuOpneIdioms = !this.menuOpneIdioms;
  }

  changeIdiom(idiom: string) {
    this.idiomActual = idiom;
    this.menuOpneIdioms = false;
  }

  toggleMobileMenu() {
    this.menuMobileOpen = !this.menuMobileOpen;
  }

  toggleIdiomsMenuMobile() {
    this.menuOpneIdiomsMobile = !this.menuOpneIdiomsMobile;
  }

  closeMobileMenu(): void {
    this.menuMobileOpen = false;
  }

  @HostListener('document:click', ['$event'])
  clickOut(event: Event) {
    const clickedOutside = !this.elementRef.nativeElement.contains(event.target);
    if (clickedOutside) {
      this.menuOpened = false;
      this.menuOpendSession = false;
      this.menuOpneIdioms = false;
    }
  }
}