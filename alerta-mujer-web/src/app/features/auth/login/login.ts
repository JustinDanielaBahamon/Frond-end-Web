import { Component, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { CardComponent } from '../../../shared/components/card/card';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CardComponent, NgIf, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  encapsulation: ViewEncapsulation.None
})
export class LoginComponent {

  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';

  error = '';
  loading = false;

  viewpassword = false;

  emailValido = true;
  passwordValida = true;

  // ------------------------
  // Mostrar/Ocultar contraseña
  // ------------------------

  showpassword() {
    this.viewpassword = !this.viewpassword;
  }

  // ------------------------
  // Validación correo
  // ------------------------

  validarCorreo() {

    if (!this.email) {
      this.emailValido = true;
      return;
    }

    const regex =
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;

    this.emailValido = regex.test(this.email);
  }

  // ------------------------
  // Validación contraseña
  // ------------------------

  validarPassword() {

    if (!this.password) {
      this.passwordValida = true;
      return;
    }

    const regex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#_-])[A-Za-z\d@$!%*?&.#_-]{8,}$/;

    this.passwordValida = regex.test(this.password);
  }

  // ------------------------

  irARegistro() {
    this.router.navigate(['/auth/register']);
  }

  irAOlvidePassword() {
    this.router.navigate(['/auth/forgot-password']);
  }

  // ------------------------
  // Login
  // ------------------------

  iniciarSesion() {

    this.validarCorreo();
    this.validarPassword();
  
    if (!this.emailValido || !this.passwordValida) {
      return;
    }
  
    this.error = '';
    this.loading = true;
  
    this.auth.login({
      email: this.email,
      password: this.password
    }).subscribe({
      next: (user) => {
        this.loading = false;
  
        if (user.rol === 'admin') {
          this.router.navigate(['/admin/dashboard']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.error = err.message;
        this.loading = false;
      }
    });
  
  }

}