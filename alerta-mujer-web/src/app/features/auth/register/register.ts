// register.ts
import { Component, ViewEncapsulation, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CardComponent } from '../../../shared/components/card/card';
import { AuthService } from '../../../core/auth/auth.service';
import { RegisterDraftService } from '../../../core/services/register-draft.service';

/* ═══════════ VALIDADORES PERSONALIZADOS ═══════════ */

/* Campo obligatorio que no acepta solo espacios en blanco */
const requerido: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  String(control.value ?? '').trim() ? null : { required: true };

/* El correo debe contener "@" (si está vacío, lo atrapa "required") */
const contieneArroba: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor = String(control.value ?? '');
  return !valor || valor.includes('@') ? null : { sinArroba: true };
};

/* La confirmación debe ser igual a la contraseña */
const coincideConPassword: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.parent?.get('password')?.value ?? '';
  return control.value === password ? null : { noCoincide: true };
};

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, CardComponent, RouterModule],
  templateUrl: './register.html',
  styleUrl: './register.scss',
  encapsulation: ViewEncapsulation.None
})
export class RegisterComponent {
  private fb     = inject(FormBuilder);
  private router = inject(Router);
  private auth   = inject(AuthService);
  private draft  = inject(RegisterDraftService);

  /* Opciones exactas de la lista desplegable */
  readonly tiposDocumento = ['T.I', 'C.C', 'Documento extranjero'];

  /* ═══════════ FORMULARIO REACTIVO ═══════════ */
  form = this.fb.nonNullable.group({
    nombre:            ['', [requerido]],
    telefono:          ['', [requerido]],
    tipoDocumento:     ['', [Validators.required]],
    numeroDocumento:   ['', [requerido]],
    fechaNacimiento:   ['', [Validators.required, Validators.minLength(10)]],
    correo:            ['', [Validators.required, contieneArroba]],
    password:          ['', [Validators.required, Validators.minLength(6)]],
    confirmarPassword: ['', [coincideConPassword]],
  });

  /* ═══════════ ESTADO DE LA PANTALLA ═══════════ */
  verPassword      = signal(false);
  verConfirmar     = signal(false);
  intentado        = signal(false);   // true cuando ya presionó "Continuar"
  cargando         = signal(false);
  exito            = signal(false);
  errorServidor    = signal('');
  errorAceptacion  = signal(false);   // "Debes aceptar términos y privacidad"
  avisoTerminos    = signal(false);   // "Debes leer los términos primero"
  avisoPrivacidad  = signal(false);   // "Debes leer la política primero"
  aceptaTerminos   = signal(false);
  aceptaPrivacidad = signal(false);

  /* Mensajes de error de cada campo */
  private readonly mensajes: Record<string, Record<string, string>> = {
    nombre:            { required: 'El nombre es obligatorio' },
    telefono:          { required: 'El teléfono es obligatorio' },
    tipoDocumento:     { required: 'El tipo de documento es obligatorio' },
    numeroDocumento:   { required: 'El número de documento es obligatorio' },
    fechaNacimiento:   {
      required: 'La fecha de nacimiento es obligatoria',
      minlength: 'Ingresa una fecha completa DD/MM/AAAA'
    },
    correo:            {
      required: 'El correo es obligatorio',
      sinArroba: 'Correo inválido'
    },
    password:          {
      required: 'La contraseña es obligatoria',
      minlength: 'Mínimo 6 caracteres'
    },
    confirmarPassword: { noCoincide: 'Las contraseñas no coinciden' },
  };

  constructor() {
    /* Si volvió de leer los términos, recuperamos lo que ya había escrito */
    if (this.draft.valores) {
      this.form.patchValue(this.draft.valores);
    }
    this.aceptaTerminos.set(this.draft.aceptaTerminos);
    this.aceptaPrivacidad.set(this.draft.aceptaPrivacidad);

    /* Si cambia la contraseña, se vuelve a revisar la confirmación */
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.confirmarPassword.updateValueAndValidity());
  }

  /* ═══════════ AYUDAS PARA EL HTML ═══════════ */

  /* ¿Mostrar el error de este campo? (después de tocarlo o de enviar) */
  invalido(campo: string): boolean {
    const control = this.form.get(campo);
    return !!control && control.invalid && (control.touched || this.intentado());
  }

  /* Texto del error de este campo */
  mensaje(campo: string): string {
    const errores = this.form.get(campo)?.errors;
    if (!errores) return '';
    const clave = Object.keys(errores)[0];
    return this.mensajes[campo]?.[clave] ?? '';
  }

  /* ═══════════ FECHA DD/MM/AAAA ═══════════
     Deja solo números (máximo 8) y pone las "/" solas.
     La primera "/" aparece al escribir el 3.er dígito y la segunda al
     escribir el 5.º; así se puede borrar con la tecla de retroceso. */
  alEscribirFecha(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digitos = input.value.replace(/\D/g, '').slice(0, 8);

    let texto = digitos;
    if (digitos.length > 4) {
      texto = `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
    } else if (digitos.length > 2) {
      texto = `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
    }

    input.value = texto;
    this.form.controls.fechaNacimiento.setValue(texto);
  }

  /* ═══════════ CASILLAS (solo después de leer) ═══════════ */

  alClickTerminos(event: Event): void {
    if (!this.draft.terminosLeidos) {
      event.preventDefault();          // la casilla no se marca
      this.avisoTerminos.set(true);
      return;
    }
    this.avisoTerminos.set(false);
  }

  alCambiarTerminos(event: Event): void {
    const marcado = (event.target as HTMLInputElement).checked;
    this.aceptaTerminos.set(marcado);
    this.draft.aceptaTerminos = marcado;
    this.errorAceptacion.set(false);
  }

  alClickPrivacidad(event: Event): void {
    if (!this.draft.privacidadLeida) {
      event.preventDefault();
      this.avisoPrivacidad.set(true);
      return;
    }
    this.avisoPrivacidad.set(false);
  }

  alCambiarPrivacidad(event: Event): void {
    const marcado = (event.target as HTMLInputElement).checked;
    this.aceptaPrivacidad.set(marcado);
    this.draft.aceptaPrivacidad = marcado;
    this.errorAceptacion.set(false);
  }

  /* ═══════════ NAVEGACIÓN ═══════════ */

  abrirTerminos(): void {
    this.guardarBorrador();
    this.router.navigate(['/auth/terms']);
  }

  abrirPrivacidad(): void {
    this.guardarBorrador();
    this.router.navigate(['/auth/privacy']);
  }

  irALogin(): void {
    this.router.navigate(['/auth/login']);
  }

  /* Guarda lo escrito antes de salir a leer los textos */
  private guardarBorrador(): void {
    this.draft.valores = this.form.getRawValue();
    this.draft.aceptaTerminos = this.aceptaTerminos();
    this.draft.aceptaPrivacidad = this.aceptaPrivacidad();
  }

  /* ═══════════ ENVIAR ═══════════ */

  continuar(): void {
    if (this.cargando() || this.exito()) return;
    this.errorServidor.set('');

    /* 1) Verificar que estén aceptados los términos y la privacidad */
    if (!this.aceptaTerminos() || !this.aceptaPrivacidad()) {
      this.errorAceptacion.set(true);
      return;
    }
    this.errorAceptacion.set(false);

    /* 2) Validar todos los campos (cada error sale bajo su campo) */
    this.intentado.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    /* 3) Todo bien: registrar, mostrar éxito y redirigir al login */
    this.cargando.set(true);
    const v = this.form.getRawValue();

    this.auth.registrar({
      nombre: v.nombre,
      telefono: v.telefono,
      tipoDocumento: v.tipoDocumento,
      numeroDocumento: v.numeroDocumento,
      fechaNacimiento: v.fechaNacimiento,
      correo: v.correo,
      password: v.password
    }).subscribe({
      next: () => {
        this.cargando.set(false);
        this.exito.set(true);
        this.draft.limpiar();
        setTimeout(() => this.router.navigate(['/auth/login']), 2000);
      },
      error: () => {
        this.cargando.set(false);
        this.errorServidor.set('No se pudo completar el registro. Intenta de nuevo.');
      }
    });
  }
}