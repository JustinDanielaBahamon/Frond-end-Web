import { Component } from '@angular/core';

@Component({
  selector: 'app-landing-navbar',
  standalone: true,
  imports: [],
  templateUrl: './landing-navbar.html',
  styleUrl: './landing-navbar.scss',
})

export class LandingNavbarComponent {

  menuOpened = false; //Definimos la variable para controlar el menú si se abre o esta cerrado

  toggleMenu() {
    this.menuOpened = !this.menuOpened; //Aqui creamos la condición para abrir o cerrar el menú
  }
}
