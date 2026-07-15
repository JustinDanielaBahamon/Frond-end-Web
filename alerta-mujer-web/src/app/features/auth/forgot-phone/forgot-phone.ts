import { Component, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { CardComponent } from '../../../shared/components/card/card';

@Component({
  selector: 'app-forgot-phone',
  standalone: true,
  imports: [
    FormsModule,
    NgIf,
    RouterModule,
    CardComponent
  ],
  templateUrl: './forgot-phone.html',
  styleUrl: './forgot-phone.scss',
  encapsulation: ViewEncapsulation.None
})
export class ForgotPhoneComponent {

  private router = inject(Router);

  telefono = '';
  telefonoValido = true;

  // -----------------------------
  // Navegación
  // -----------------------------

  volverLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  irARecuperarCorreo(): void {
    this.router.navigate(['/auth/forgot-password']);
  }

  // -----------------------------
  // Solo permitir números
  // -----------------------------

  soloNumeros(event: KeyboardEvent): void {

    const teclasPermitidas = [
      'Backspace',
      'Delete',
      'ArrowLeft',
      'ArrowRight',
      'Tab'
    ];

    if (teclasPermitidas.includes(event.key)) {
      return;
    }

    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }

  }

  // -----------------------------
  // Validación teléfono colombiano
  // -----------------------------

  validarTelefono(): void {

    // Elimina cualquier carácter que no sea número
    this.telefono = this.telefono.replace(/\D/g, '');

    // Máximo 10 dígitos
    if (this.telefono.length > 10) {
      this.telefono = this.telefono.substring(0, 10);
    }

    // Si está vacío no mostrar error
    if (!this.telefono) {
      this.telefonoValido = true;
      return;
    }

    // Debe comenzar por 3 y tener exactamente 10 dígitos
    const regex = /^3\d{9}$/;

    this.telefonoValido = regex.test(this.telefono);

  }

  // -----------------------------
  // Enviar código
  // -----------------------------

  enviarCodigo(): void {

    this.validarTelefono();

    if (!this.telefonoValido) {
      return;
    }

    // Número listo para enviar al backend
    const numeroCompleto = `+57${this.telefono}`;

    console.log('Número enviado:', numeroCompleto);

    // Aquí después llamarás al servicio

    this.router.navigate(['/auth/verify-code']);

  }

}