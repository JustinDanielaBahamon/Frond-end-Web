import { Component, ViewEncapsulation, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';

import { NgIf } from '@angular/common';

import { Router, RouterModule } from '@angular/router';

import { CardComponent } from '../../../shared/components/card/card';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    FormsModule,
    NgIf,
    RouterModule,
    CardComponent
  ],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
  encapsulation: ViewEncapsulation.None
})

export class ForgotPasswordComponent {

  private router = inject(Router);

  email = '';
  emailValido=true;

  volverLogin() {
    this.router.navigate(['/auth/login']);
  }

  validarCorreo() {

    if (!this.email) {
      this.emailValido = true;
      return;
    }
  
    const regex =
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;
  
    this.emailValido = regex.test(this.email);
  
  }

  enviarCorreo() {

    this.validarCorreo();
  
    if (!this.emailValido) {
      return;
    }
  
    console.log("Enviar correo a:", this.email);
  
    // Ir a verificar código
    this.router.navigate(['/auth/verify-code']);
  
  }

  irARecuperacionTelefono() {
    this.router.navigate(['/auth/forgot-phone']);
  }

}
