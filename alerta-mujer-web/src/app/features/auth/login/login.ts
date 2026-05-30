import { Component, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardComponent } from '../../../shared/components/card/card';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CardComponent],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  encapsulation: ViewEncapsulation.None  // ← agrega esta línea
})
export class LoginComponent {
  email = '';
  password = '';

  iniciarSesion() {
    console.log('Email:', this.email);
    console.log('Password:', this.password);
  }
}