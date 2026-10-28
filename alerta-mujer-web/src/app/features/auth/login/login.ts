import { TPipe } from '../../../core/i18n/i18n';
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
  imports: [TPipe, FormsModule, CardComponent, NgIf, RouterModule],
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

  viewPassword = false;

  validEmail = true;
  validPassword = true;

  // ------------------------
  // Show/Hide password
  // ------------------------

  showpassword() {
    this.viewPassword = !this.viewPassword;
  }

  // ------------------------
  // Email validation
  // ------------------------

  validateEmail() {

    if (!this.email) {
      this.validEmail = true;
      return;
    }

    const regex =
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;

    this.validEmail = regex.test(this.email);
  }

  // ------------------------
  // Password validation
  // ------------------------

  validatePassword() {

    // No format rules are required when signing in: accounts created in the app or through
    // recovery only require 8 characters, and the backend is the one that validates the password.
    this.validPassword = true;
  }

  // ------------------------
  // Navigation
  // ------------------------

  goToRegister() {
    this.router.navigate(['/auth/register']);
  }

  goToForgotPassword() {
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
  async continueWithGoogle() {
    if (this.loadingGoogle) return;
    this.error = '';
    this.loadingGoogle = true;
    try {
      const idToken = await this.googleAuth.getIdToken();
      this.auth.loginWithGoogle(idToken).subscribe({
        next: (user) => {
          this.loadingGoogle = false;
          this.router.navigate([user.role === 'Admin' ? '/admin/dashboard' : '/dashboard']);
        },
        error: (err) => {
          this.loadingGoogle = false;
          this.error = err.message;
        },
      });
    } catch (e: any) {
      this.loadingGoogle = false;
      // Closing the Google window is not an error that needs to be shown
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
      this.error = e?.code === 'auth/popup-blocked'
        ? 'Tu navegador bloqueó la ventana de Google. Permite ventanas emergentes e intenta de nuevo.'
        : e?.message ?? 'No se pudo iniciar sesión con Google.';
    }
  }

  signIn() {

    this.validateEmail();
    this.validatePassword();

    if (!this.validEmail || !this.validPassword) {
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

        if (user.role === 'Admin' || user.role === 'admin') {
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