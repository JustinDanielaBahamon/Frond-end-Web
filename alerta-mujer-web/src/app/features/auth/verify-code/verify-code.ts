import { Component } from '@angular/core';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { CardComponent } from '../../../shared/components/card/card';

@Component({
  selector: 'app-verify-code',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgIf,
    NgFor,
    RouterModule,
    CardComponent
  ],
  templateUrl: './verify-code.html',
  styleUrl: './verify-code.scss'
})
export class VerifyCodeComponent {

  constructor(private router: Router) {}

  // Mensaje superior
  mensajeEnvio =
    'Hemos enviado un código de verificación de 6 dígitos a tu correo electrónico.';

  // Código
  codigo: string[] = ['', '', '', '', '', ''];

  // Temporizador
  tiempoRestante = 120;

  puedeReenviar = false;

  ngOnInit() {
    this.iniciarTemporizador();
  }

  get tiempoFormateado(): string {

    const min = Math.floor(this.tiempoRestante / 60);
    const seg = this.tiempoRestante % 60;

    return `${min}:${seg.toString().padStart(2, '0')}`;
  }

  get codigoCompleto(): boolean {
    return this.codigo.every(x => x !== '');
  }

  trackByIndex(index: number) {
    return index;
  }

  onInput(event: Event, index: number) {

    const input = event.target as HTMLInputElement;

    const valor = input.value.replace(/\D/g, '');

    this.codigo[index] = valor;

    if (valor && input.nextElementSibling instanceof HTMLInputElement) {
      input.nextElementSibling.focus();
    }
  }

  onKeyDown(event: KeyboardEvent, index: number) {

    const input = event.target as HTMLInputElement;

    if (
      event.key === 'Backspace' &&
      !input.value &&
      input.previousElementSibling instanceof HTMLInputElement
    ) {

      input.previousElementSibling.focus();

    }

  }

  onPaste(event: ClipboardEvent) {

    event.preventDefault();

    const texto =
      event.clipboardData?.getData('text').replace(/\D/g, '') || '';

    texto.split('').slice(0, 6).forEach((numero, i) => {
      this.codigo[i] = numero;
    });

  }

  iniciarTemporizador() {

    const intervalo = setInterval(() => {

      if (this.tiempoRestante > 0) {

        this.tiempoRestante--;

      } else {

        this.puedeReenviar = true;

        clearInterval(intervalo);

      }

    }, 1000);

  }

  reenviarCodigo() {

    this.tiempoRestante = 120;

    this.puedeReenviar = false;

    this.iniciarTemporizador();

    console.log('Código reenviado');

  }

  verificarCodigo() {

    const codigo = this.codigo.join('');

    console.log('Código:', codigo);

    // Aquí luego llamarás al backend

    this.router.navigate(['/auth/reset-password']);

  }

  cambiarMetodo() {

    this.router.navigate(['/auth/forgot-password']);

  }

}