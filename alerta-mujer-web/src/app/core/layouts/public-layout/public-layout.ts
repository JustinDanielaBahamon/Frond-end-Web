import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LandingNavbarComponent } from './landing-navbar/landing-navbar';
import { heroComponent } from '../../../features/landing/components/hero/hero';
import { HowItWorksComponent } from '../../../features/landing/components/how-it-works/how-it-works';
import { FeaturesSectionComponent } from '../../../features/landing/components/features-section/features-section';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    LandingNavbarComponent,
    heroComponent,
    FeaturesSectionComponent,
    HowItWorksComponent
  ],
  templateUrl: './public-layout.html',
  styleUrl: './public-layout.scss',
})
export class PublicLayoutComponent {}