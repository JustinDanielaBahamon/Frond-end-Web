import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RegisterDraftService } from '../../../core/services/register-draft.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-privacy',
  standalone: true,
  templateUrl: './privacy.html',
  styleUrl: '../legal/legal.scss'
})
export class PrivacyComponent {
  private router = inject(Router);
  private draft  = inject(RegisterDraftService);
  private auth   = inject(AuthService);

  /** Con sesión iniciada se llegó desde Ajustes; si no, desde el registro. */
  readonly conSesion = this.auth.isLoggedIn();
  readonly textoVolver = this.conSesion ? 'Volver a Ajustes' : 'Volver al registro';
  readonly textoEntendido = this.conSesion ? 'Entendido, volver a Ajustes' : 'Entendido, volver al registro';

  volver() {
    if (this.conSesion) {
      const admin = this.auth.getCurrentUser()?.rol === 'Admin';
      this.router.navigate([admin ? '/admin/settings' : '/dashboard/settings']);
      return;
    }
    this.draft.privacidadLeida = true;   // habilita el checkbox en el registro
    this.router.navigate(['/auth/register']);
  }
}