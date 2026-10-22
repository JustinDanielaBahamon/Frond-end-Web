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
const required: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  String(control.value ?? '').trim() ? null : { required: true };

/* El correo debe contener "@" (si está vacío, lo atrapa "required") */
const containsAt: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  return !value || value.includes('@') ? null : { sinArroba: true };
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
  readonly documentTypes = ['T.I', 'C.C', 'Documento extranjero'];

  /* ═══════════ FORMULARIO REACTIVO ═══════════ */
  form = this.fb.nonNullable.group({
    nombre:            ['', [required]],
    telefono:          ['', [required]],
    tipoDocumento:     ['', [Validators.required]],
    numeroDocumento:   ['', [required]],
    fechaNacimiento:   ['', [Validators.required, Validators.minLength(10)]],
    email:            ['', [Validators.required, containsAt]],
    password:          ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [coincideConPassword]],
  });

  /* ═══════════ ESTADO DE LA PANTALLA ═══════════ */
  verPassword      = signal(false);
  showConfirm     = signal(false);
  attempted        = signal(false);   // true cuando ya presionó "Continuar"
  loading         = signal(false);
  success            = signal(false);
  serverError    = signal('');
  acceptanceError  = signal(false);   // "Debes aceptar términos y privacidad"
  termsNotice    = signal(false);   // "Debes leer los términos primero"
  privacyNotice  = signal(false);   // "Debes leer la política primero"
  aceptaTerminos   = signal(false);
  acceptsPrivacy = signal(false);

  /* Mensajes de error de cada campo */
  private readonly messages: Record<string, Record<string, string>> = {
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
      minlength: 'Mínimo 8 caracteres'
    },
    confirmarPassword: { noCoincide: 'Las contraseñas no coinciden' },
  };

  constructor() {
    /* Si volvió de leer los términos, recuperamos lo que ya había escrito */
    if (this.draft.values) {
      this.form.patchValue(this.draft.values);
    }
    this.aceptaTerminos.set(this.draft.aceptaTerminos);
    this.acceptsPrivacy.set(this.draft.acceptsPrivacy);

    /* Si cambia la contraseña, se vuelve a revisar la confirmación */
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.confirmPassword.updateValueAndValidity());
  }

  /* ═══════════ AYUDAS PARA EL HTML ═══════════ */

  /* ¿Mostrar el error de este campo? (después de tocarlo o de enviar) */
  invalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.touched || this.attempted());
  }

  /* Texto del error de este campo */
  message(field: string): string {
    const errores = this.form.get(field)?.errors;
    if (!errores) return '';
    const key = Object.keys(errores)[0];
    // Los avisos del servidor (dato ya registrado) traen su propio texto
    if (typeof errores[key] === 'string') return errores[key];
    return this.messages[field]?.[key] ?? '';
  }

  /* ═══════════ FECHA DD/MM/AAAA ═══════════
     Deja solo números (máximo 8) y pone las "/" solas.
     La primera "/" aparece al escribir el 3.er dígito y la segunda al
     escribir el 5.º; así se puede borrar con la tecla de retroceso. */
  onDateInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 8);

    let text = digits;
    if (digits.length > 4) {
      text = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      text = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }

    input.value = text;
    this.form.controls.fechaNacimiento.setValue(text);
  }

  /* ═══════════ CASILLAS (solo después de leer) ═══════════ */

  onTermsClick(event: Event): void {
    if (!this.draft.termsRead) {
      event.preventDefault();          // la casilla no se marca
      this.termsNotice.set(true);
      return;
    }
    this.termsNotice.set(false);
  }

  onTermsChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.aceptaTerminos.set(checked);
    this.draft.aceptaTerminos = checked;
    this.acceptanceError.set(false);
  }

  onPrivacyClick(event: Event): void {
    if (!this.draft.privacyRead) {
      event.preventDefault();
      this.privacyNotice.set(true);
      return;
    }
    this.privacyNotice.set(false);
  }

  onPrivacyChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.acceptsPrivacy.set(checked);
    this.draft.acceptsPrivacy = checked;
    this.acceptanceError.set(false);
  }

  /* ═══════════ NAVEGACIÓN ═══════════ */

  openTerms(): void {
    this.saveDraft();
    this.router.navigate(['/auth/terms']);
  }

  openPrivacy(): void {
    this.saveDraft();
    this.router.navigate(['/auth/privacy']);
  }

  irALogin(): void {
    this.router.navigate(['/auth/login']);
  }

  /* Guarda lo escrito antes de salir a leer los textos */
  private saveDraft(): void {
    this.draft.values = this.form.getRawValue();
    this.draft.aceptaTerminos = this.aceptaTerminos();
    this.draft.acceptsPrivacy = this.acceptsPrivacy();
  }

  /* ═══════════ ENVIAR ═══════════ */

  proceed(): void {
    if (this.loading() || this.success()) return;
    this.serverError.set('');

    /* 1) Verificar que estén aceptados los términos y la privacidad */
    if (!this.aceptaTerminos() || !this.acceptsPrivacy()) {
      this.acceptanceError.set(true);
      return;
    }
    this.acceptanceError.set(false);

    /* 2) Validar todos los campos (cada error sale bajo su campo) */
    this.attempted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    /* 3) Todo bien: registrar, mostrar éxito y redirigir al login */
    this.loading.set(true);
    const v = this.form.getRawValue();

    this.auth.registrar({
      nombre: v.nombre,
      telefono: v.telefono,
      tipoDocumento: v.tipoDocumento,
      numeroDocumento: v.numeroDocumento,
      fechaNacimiento: v.fechaNacimiento,
      email: v.email,
      password: v.password,
      aceptaTerminos: this.aceptaTerminos() && this.acceptsPrivacy()
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        this.draft.clear();
        setTimeout(() => this.router.navigate(['/auth/login']), 2000);
      },
      error: (e: { campos?: Record<string, string> }) => {
        this.loading.set(false);
        if (e.campos && this.markRepeated(e.campos)) return;
        this.serverError.set('No se pudo completar el registro. Intenta de nuevo.');
      }
    });
  }

  /* Datos que ya usa otra cuenta: el aviso queda debajo de su campo hasta que se edite */
  private markRepeated(campos: Record<string, string>): boolean {
    const controles: Record<string, AbstractControl> = {
      email: this.form.controls.email,
      telefono: this.form.controls.telefono,
      numeroDocumento: this.form.controls.numeroDocumento,
    };
    let checked = 0;
    for (const [field, notice] of Object.entries(campos)) {
      const control = controles[field];
      if (!control) continue;
      control.setErrors({ repetido: notice });
      control.markAsTouched();
      checked++;
    }
    return checked > 0;
  }
}
