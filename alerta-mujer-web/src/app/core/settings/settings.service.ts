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

  setLanguage(lang: AppLanguage): void {
    this.language.set(lang);
    localStorage.setItem(LANG_KEY, lang);
    this.applyLanguage(lang);
    // TODO: connect this to your i18n library (ngx-translate, @angular/localize, etc.)
    // For now this service only stores the preference and sets the `lang` attribute
    // on the <html>; it does not translate the app texts automatically.
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