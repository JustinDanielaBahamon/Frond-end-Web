import { Injectable, signal } from '@angular/core';

export type AppLanguage = 'es' | 'en';
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
    // TODO: conecta esto con tu librería de i18n (ngx-translate, @angular/localize, etc.)
    // Este servicio por ahora solo guarda la preferencia y pone el atributo `lang`
    // en el <html>; no traduce automáticamente los textos de la app.
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