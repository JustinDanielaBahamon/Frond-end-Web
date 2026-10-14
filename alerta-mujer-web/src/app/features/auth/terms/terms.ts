import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RegisterDraftService } from '../../../core/services/register-draft.service';

@Component({
  selector: 'app-terms',
  standalone: true,
  templateUrl: './terms.html',
  styleUrl: '../legal/legal.scss'
})
export class TermsComponent {
  private router = inject(Router);
  private draft  = inject(RegisterDraftService);

  volver() {
    this.draft.terminosLeidos = true;   // habilita el checkbox en el registro
    this.router.navigate(['/auth/register']);
  }
}