import { Component, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { CardComponent } from '../../../shared/components/card/card';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, CardComponent, NgIf, RouterModule],
  templateUrl: './register.html',
  styleUrl: './register.scss',
  encapsulation: ViewEncapsulation.None
})
export class RegisterComponent {
  private router = inject(Router);

  nombre         = '';
  apellido       = '';
  edad: number | null = null;
  telefono       = '';
  correo         = '';
  aceptaTerminos = false;
  error          = '';

  irALogin() {
    this.router.navigate(['/auth/login']);
  }

  formularioValido(): boolean {
    return !!(
      this.nombre.trim() &&
      this.apellido.trim() &&
      this.edad &&
      this.edad >= 13 &&
      this.telefono.trim() &&
      this.correo.trim() &&
      this.aceptaTerminos
    );
  }

  registrar(): void {
    this.error = '';
    if (!this.formularioValido()) {
      this.error = 'Por favor completa todos los campos correctamente.';
      return;
    }
    this.router.navigate(['/auth/login']);
  }
}