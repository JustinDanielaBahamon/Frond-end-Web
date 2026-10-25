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

/* Required field that does not accept only blank spaces */
const required: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  String(control.value ?? '').trim() ? null : { required: true };

/* The email must contain "@" (if empty, "required" catches it) */
const containsAt: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  return !value || value.includes('@') ? null : { sinArroba: true };
};

/* The confirmation must match the password */
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

  /* Exact dropdown options */
  readonly documentTypes = ['T.I', 'C.C', 'Documento extranjero'];

  /* ═══════════ FORMULARIO REACTIVO ═══════════ */
  form = this.fb.nonNullable.group({
    name:            ['', [required]],
    telephone:          ['', [required]],
    documentType:     ['', [Validators.required]],
    documentNumber:   ['', [required]],
    birthDate:   ['', [Validators.required, Validators.minLength(10)]],
    email:            ['', [Validators.required, containsAt]],
    password:          ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [coincideConPassword]],
  });

  /* ═══════════ SCREEN STATE ═══════════ */
  showPassword      = signal(false);
  showConfirm     = signal(false);
  attempted        = signal(false);   // true once "Continuar" was pressed
  loading         = signal(false);
  success            = signal(false);
  serverError    = signal('');
  acceptanceError  = signal(false);   // "Debes aceptar términos y privacidad"
  termsNotice    = signal(false);   // "Debes leer los términos primero"
  privacyNotice  = signal(false);   // "Debes leer la política primero"
  acceptsTerms   = signal(false);
  acceptsPrivacy = signal(false);

  /* Error messages of each field */
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
    /* If she came back from reading the terms, we restore what she had typed */
    if (this.draft.values) {
      this.form.patchValue(this.draft.values);
    }
    this.acceptsTerms.set(this.draft.acceptsTerms);
    this.acceptsPrivacy.set(this.draft.acceptsPrivacy);

    /* If the password changes, the confirmation is checked again */
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.confirmPassword.updateValueAndValidity());
  }

  /* ═══════════ HTML HELPERS ═══════════ */

  /* Show the error of this field? (after touching it or submitting) */
  invalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.touched || this.attempted());
  }

  /* Error text of this field */
  message(field: string): string {
    const errors = this.form.get(field)?.errors;
    if (!errors) return '';
    const key = Object.keys(errors)[0];
    // Server notices (data already registered) carry their own text
    if (typeof errors[key] === 'string') return errors[key];
    return this.messages[field]?.[key] ?? '';
  }

  /*
 * ═══════════ DATE DD/MM/YYYY ═══════════
 *      Keeps only digits (at most 8) and inserts the "/" by itself.
 *      The first "/" appears when typing the 3rd digit and the second when
 *      typing the 5th; that way it can be deleted with backspace.
 */
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
    this.form.controls.birthDate.setValue(text);
  }

  /* ═══════════ CHECKBOXES (only after reading) ═══════════ */

  onTermsClick(event: Event): void {
    if (!this.draft.termsRead) {
      event.preventDefault();          // the checkbox is not checked
      this.termsNotice.set(true);
      return;
    }
    this.termsNotice.set(false);
  }

  onTermsChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.acceptsTerms.set(checked);
    this.draft.acceptsTerms = checked;
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

  /* Saves what was typed before leaving to read the texts */
  private saveDraft(): void {
    this.draft.values = this.form.getRawValue();
    this.draft.acceptsTerms = this.acceptsTerms();
    this.draft.acceptsPrivacy = this.acceptsPrivacy();
  }

  /* ═══════════ ENVIAR ═══════════ */

  proceed(): void {
    if (this.loading() || this.success()) return;
    this.serverError.set('');

    /* 1) Check that the terms and privacy are accepted */
    if (!this.acceptsTerms() || !this.acceptsPrivacy()) {
      this.acceptanceError.set(true);
      return;
    }
    this.acceptanceError.set(false);

    /* 2) Validate every field (each error shows under its field) */
    this.attempted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    /* 3) All good: register, show success and redirect to the login */
    this.loading.set(true);
    const v = this.form.getRawValue();

    this.auth.registrar({
      name: v.name,
      telephone: v.telephone,
      documentType: v.documentType,
      documentNumber: v.documentNumber,
      birthDate: v.birthDate,
      email: v.email,
      password: v.password,
      acceptsTerms: this.acceptsTerms() && this.acceptsPrivacy()
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

  /* Data already used by another account: the notice stays under its field until it is edited */
  private markRepeated(campos: Record<string, string>): boolean {
    const controls: Record<string, AbstractControl> = {
      email: this.form.controls.email,
      telefono: this.form.controls.telephone,
      numeroDocumento: this.form.controls.documentNumber,
    };
    let checked = 0;
    for (const [field, notice] of Object.entries(campos)) {
      const control = controls[field];
      if (!control) continue;
      control.setErrors({ repetido: notice });
      control.markAsTouched();
      checked++;
    }
    return checked > 0;
  }
}
