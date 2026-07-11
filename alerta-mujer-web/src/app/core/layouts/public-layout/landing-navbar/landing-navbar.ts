import { Component, HostListener, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-navbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing-navbar.html',
  styleUrl: './landing-navbar.scss',
})
export class LandingNavbarComponent {

  menuOpened = false;        // Controla el menú principal (ej. hamburguesa en móvil)
  menuOpendSession = false;  // Controla el menú de sesión
  menuOpneIdioms = false;    // Controla el menú de idiomas
  idiomActual = 'ES';
  menuMobileOpen = false;
  menuOpneIdiomsMobile = false;


  // Inyectamos ElementRef para que Angular pueda rastrear los clics dentro de este componente
  constructor(private elementRef: ElementRef) {}

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
    this.menuOpneIdioms = false; // Se cierra automáticamente al elegir idioma
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

  // 🔥 Escucha global de clics para cerrar menús al hacer clic fuera
  @HostListener('document:click', ['$event'])
  clickOut(event: Event) {
    // Verificamos si el clic fue fuera de todo el navbar
    const clickedOutside = !this.elementRef.nativeElement.contains(event.target);

    if (clickedOutside) {
      // Si hizo clic afuera, reseteamos todos los menús a false (cerrados)
      this.menuOpened = false;
      this.menuOpendSession = false;
      this.menuOpneIdioms = false;
    }
  }
}