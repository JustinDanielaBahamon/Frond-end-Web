import { Injectable } from '@angular/core';

/*
  Guarda temporalmente el estado del formulario de registro
  mientras la usuaria lee los Términos o la Política de privacidad.
  Vive solo en memoria: si recarga la página, se pierde.
*/
@Injectable({ providedIn: 'root' })
export class RegisterDraftService {

  /* Lo que la usuaria ya escribió en el formulario */
  valores: any = null;

  /* Marcan si ya abrió cada texto (permiten marcar la casilla) */
  terminosLeidos = false;
  privacidadLeida = false;

  /* Estado de las casillas */
  aceptaTerminos = false;
  aceptaPrivacidad = false;

  /* Se llama cuando el registro termina bien */
  limpiar(): void {
    this.valores = null;
    this.terminosLeidos = false;
    this.privacidadLeida = false;
    this.aceptaTerminos = false;
    this.aceptaPrivacidad = false;
  }
}