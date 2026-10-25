import { TPipe } from '../../../core/i18n/i18n';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RegisterDraftService } from '../../../core/services/register-draft.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [TPipe],
  templateUrl: './privacy.html',
  styleUrl: '../legal/legal.scss'
})
export class PrivacyComponent {
  private router = inject(Router);
  private draft  = inject(RegisterDraftService);
  private auth   = inject(AuthService);

  /** With a session it came from Settings; otherwise, from the registration. */
  readonly withSession = this.auth.isLoggedIn();
  readonly backText = this.withSession ? 'Volver a Ajustes' : 'Volver al registro';
  readonly understoodText = this.withSession ? 'Entendido, volver a Ajustes' : 'Entendido, volver al registro';

  back() {
    if (this.withSession) {
      const admin = this.auth.getCurrentUser()?.role === 'Admin';
      this.router.navigate([admin ? '/admin/settings' : '/dashboard/settings']);
      return;
    }
    this.draft.privacyRead = true;   // enables the checkbox in the registration
    this.router.navigate(['/auth/register']);
  }
}