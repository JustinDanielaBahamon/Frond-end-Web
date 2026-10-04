import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-terms',
  standalone: true,
  templateUrl: './terms.html',
  styleUrl: '../legal/legal.scss'
})
export class TermsComponent {
  private router = inject(Router);

  volver() {
    this.router.navigate(['/auth/register']);
  }
}