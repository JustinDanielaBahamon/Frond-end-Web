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
  private auth   = inject(AuthService);
  private router = inject(Router);

  email    = '';
  password = '';
  error    = '';
  loading  = false;

  irARegistro() {
    this.router.navigate(['/auth/register']);
  }

  irAOlvidePassword() {
    this.router.navigate(['/auth/forgot-password']);
  }

  iniciarSesion() {
    this.error   = '';
    this.loading = true;
    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: ()     => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error   = err.message;
        this.loading = false;
      }
    });
  }
}