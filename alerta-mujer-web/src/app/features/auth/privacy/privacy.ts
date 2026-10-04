import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-privacy',
  standalone: true,
  templateUrl: './privacy.html',
  styleUrl: '../legal/legal.scss'
})
export class PrivacyComponent {
  private router = inject(Router);

  volver() {
    this.router.navigate(['/auth/register']);
  }
}