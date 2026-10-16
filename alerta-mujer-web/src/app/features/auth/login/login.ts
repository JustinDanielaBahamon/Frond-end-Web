import { Component, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { CardComponent } from '../../../shared/components/card/card';
import { AuthService } from '../../../core/auth/auth.service';
import { GoogleAuthService } from '../../../core/auth/google-auth.service';

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
  private googleAuth = inject(GoogleAuthService);
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
  // Navegación
  // ------------------------

  irARegistro() {
    this.router.navigate(['/auth/register']);
  }

  irAOlvidePassword() {
    this.router.navigate(['/auth/forgot-password']);
  }

  irAlLanding() {
    this.router.navigate(['/']);
  }

  // ------------------------
  // Login
  // ------------------------

  loadingGoogle = false;

  // ------------------------
  // Login con Google (Firebase -> backend)
  // ------------------------
  async continuarConGoogle() {
    if (this.loadingGoogle) return;
    this.error = '';
    this.loadingGoogle = true;
    try {
      const idToken = await this.googleAuth.obtenerIdToken();
      this.auth.loginWithGoogle(idToken).subscribe({
        next: (user) => {
          this.loadingGoogle = false;
          this.router.navigate([user.rol === 'Admin' ? '/admin/dashboard' : '/dashboard']);
        },
        error: (err) => {
          this.loadingGoogle = false;
          this.error = err.message;
        },
      });
    } catch (e: any) {
      this.loadingGoogle = false;
      // Cerrar la ventana de Google no es un error que haya que mostrar
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
      this.error = e?.code === 'auth/popup-blocked'
        ? 'Tu navegador bloqueó la ventana de Google. Permite ventanas emergentes e intenta de nuevo.'
        : e?.message ?? 'No se pudo iniciar sesión con Google.';
    }
  }

  iniciarSesion() {

    this.validarCorreo();
    this.validarPassword();

    if (!this.emailValido || !this.passwordValida) {
      this.error = 'Por favor verifica que el correo y la contraseña sean válidos';
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

        if (user.rol === 'Admin' || user.rol === 'admin') {
          this.router.navigate(['/admin/dashboard']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        console.error('Error en login:', err);
        this.error = err.message || 'Error al iniciar sesión';
        this.loading = false;
      }
    });

  }

}