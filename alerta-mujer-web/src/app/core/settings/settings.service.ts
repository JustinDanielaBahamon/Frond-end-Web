import { Injectable, signal } from '@angular/core';

export type AppLanguage = 'es' | 'en' | 'fr' | 'pt';
export type AppFontSize = 'sm' | 'md' | 'lg';

const LANG_KEY = 'am-language';
const FONT_KEY = 'am-font-size';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  language = signal<AppLanguage>(
    (localStorage.getItem(LANG_KEY) as AppLanguage) || 'es'
  );
  fontSize = signal<AppFontSize>(
    (localStorage.getItem(FONT_KEY) as AppFontSize) || 'md'
  );

  constructor() {
    this.applyLanguage(this.language());
    this.applyFontSize(this.fontSize());
  }

  /** The texts are translated when the app starts (core/i18n): a new language reloads the page. */
  setLanguage(lang: AppLanguage): void {
    if (lang === this.language()) return;
    this.language.set(lang);
    localStorage.setItem(LANG_KEY, lang);
    this.applyLanguage(lang);
    location.reload();
  }

  setFontSize(size: AppFontSize): void {
    this.fontSize.set(size);
    localStorage.setItem(FONT_KEY, size);
    this.applyFontSize(size);
  }

  private applyLanguage(lang: AppLanguage): void {
    document.documentElement.lang = lang;
  }

  private applyFontSize(size: AppFontSize): void {
    document.documentElement.setAttribute('data-font-size', size);
  }
}