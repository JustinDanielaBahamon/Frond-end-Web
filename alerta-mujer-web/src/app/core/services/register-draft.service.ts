import { Injectable } from '@angular/core';

/*
  Guarda temporalmente el estado del formulario de registro
  mientras la usuaria lee los Términos o la Política de privacidad.
  Vive solo en memoria: si recarga la página, se pierde.
*/
@Injectable({ providedIn: 'root' })
export class RegisterDraftService {

  /* Lo que la usuaria ya escribió en el formulario */
  values: any = null;

  /* Marcan si ya abrió cada texto (permiten marcar la casilla) */
  termsRead = false;
  privacyRead = false;

  /* Estado de las casillas */
  aceptaTerminos = false;
  acceptsPrivacy = false;

  /* Se llama cuando el registro termina bien */
  clear(): void {
    this.values = null;
    this.termsRead = false;
    this.privacyRead = false;
    this.aceptaTerminos = false;
    this.acceptsPrivacy = false;
  }
}