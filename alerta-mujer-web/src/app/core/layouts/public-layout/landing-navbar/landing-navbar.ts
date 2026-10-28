import { TPipe } from '../../../i18n/i18n';
import { Component, HostListener, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../../theme/theme.service';
import { AppLanguage, SettingsService } from '../../../settings/settings.service';

@Component({
  selector: 'app-landing-navbar',
  standalone: true,
  imports: [TPipe, RouterLink],
  templateUrl: './landing-navbar.html',
  styleUrl: './landing-navbar.scss',
})
export class LandingNavbarComponent {

  menuOpened = false;
  menuOpendSession = false;
  languageMenuOpen = false;
  menuMobileOpen = false;
  languageMenuOpenMobile = false;

  constructor(
    private elementRef: ElementRef,
    public themeService: ThemeService,   // public so it can be used in the HTML
    private settings: SettingsService,
  ) {}

  /** The language of the whole web (the same choice as the panel). */
  get currentLanguage(): string {
    return this.settings.language().toUpperCase();
  }

  toggleMenu() {
    this.menuOpened = !this.menuOpened;
  }

  toggleSessionMenu() {
    this.menuOpendSession = !this.menuOpendSession;
  }

  toggleIdiomsMenu() {
    this.languageMenuOpen = !this.languageMenuOpen;
  }

  changeIdiom(idiom: string) {
    this.languageMenuOpen = false;
    this.settings.setLanguage(idiom.toLowerCase() as AppLanguage);
  }

  toggleMobileMenu() {
    this.menuMobileOpen = !this.menuMobileOpen;
  }

  toggleIdiomsMenuMobile() {
    this.languageMenuOpenMobile = !this.languageMenuOpenMobile;
  }

  closeMobileMenu(): void {
    this.menuMobileOpen = false;
  }

  @HostListener('document:click', ['$event'])
  clickOut(event: Event) {
    const clickedOutside = !this.elementRef.nativeElement.contains(event.target);
    if (clickedOutside) {
      this.menuOpened = false;
      this.menuOpendSession = false;
      this.languageMenuOpen = false;
    }
  }
}