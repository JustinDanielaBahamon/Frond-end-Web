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

  menuOpendSession = false; //Definimos la variable para controlar el menú de sesión si se abre o esta cerrado
  
  menuOpneIdioms = false; //Definimos la variable para controlar el menú de idiomas si se abre o esta cerrado

  toggleMenu() {
    this.menuOpened = !this.menuOpened; //Aqui creamos la condición para abrir o cerrar el menú
  }

  toggleSessionMenu(){
    this.menuOpendSession = !this.menuOpendSession; //Aqui creamos la condición para abrir o cerrar el menú de sesión
  }

  toggleIdiomsMenu(){
    this.menuOpneIdioms = !this.menuOpneIdioms; //Aqui creamos la condición para abrir o cerrar el menú de idiomas
  }


}
