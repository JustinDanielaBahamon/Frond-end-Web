import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LandingNavbarComponent } from './landing-navbar/landing-navbar';
import { heroComponent } from '../../../features/landing/components/hero/hero';
import { HowItWorksComponent } from '../../../features/landing/components/how-it-works/how-it-works';
import { FeaturesSectionComponent } from '../../../features/landing/components/features-section/features-section';
import { ReviewComponent } from '../../../features/landing/components/review/review';
import { DownloadSectionComponent } from '../../../features/landing/components/download-section/download-section';
import { FaqSectionComponent } from '../../../features/landing/components/faq-section/faq-section';
import {ContactSectionCompoent} from '../../../features/landing/components/contact-section/contact-section';
import {FooterSectionComopent} from '../../../features/landing/components/footer-section/footer-section'

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    LandingNavbarComponent,
    heroComponent,
    FeaturesSectionComponent,
    HowItWorksComponent,
    ReviewComponent,
    DownloadSectionComponent,
    FaqSectionComponent,
    ContactSectionCompoent,
    FooterSectionComopent
  ],
  templateUrl: './public-layout.html',
  styleUrl: './public-layout.scss',
})
export class PublicLayoutComponent {}