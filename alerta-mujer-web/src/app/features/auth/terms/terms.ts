import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RegisterDraftService } from '../../../core/services/register-draft.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-terms',
  standalone: true,
  templateUrl: './terms.html',
  styleUrl: '../legal/legal.scss'
})
export class TermsComponent {
  private router = inject(Router);
  private draft  = inject(RegisterDraftService);
  private auth   = inject(AuthService);

  /** Con sesión iniciada se llegó desde Ajustes; si no, desde el registro. */
  readonly withSession = this.auth.isLoggedIn();
  readonly backText = this.withSession ? 'Volver a Ajustes' : 'Volver al registro';
  readonly understoodText = this.withSession ? 'Entendido, volver a Ajustes' : 'Entendido, volver al registro';

  back() {
    if (this.withSession) {
      const admin = this.auth.getCurrentUser()?.role === 'Admin';
      this.router.navigate([admin ? '/admin/settings' : '/dashboard/settings']);
      return;
    }
    this.draft.termsRead = true;   // habilita el checkbox en el registro
    this.router.navigate(['/auth/register']);
  }
}