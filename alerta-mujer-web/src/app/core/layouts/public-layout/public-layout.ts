import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LandingNavbarComponent } from './landing-navbar/landing-navbar';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    LandingNavbarComponent
  ],
  templateUrl: './public-layout.html',
  styleUrl: './public-layout.scss',
})
export class PublicLayoutComponent {}