import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'alerta-mujer-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {

  private readonly theme = signal<Theme>(this.getInitialTheme());

  // exposed as read-only so the components can
  // react to the current theme without mutating it directly
  readonly currentTheme = this.theme.asReadonly();

  constructor() {
    // every time theme changes, applies the attribute to <html>
    // and stores it for the next visit
    effect(() => {
      const value = this.theme();
      document.documentElement.setAttribute('data-theme', value);
      localStorage.setItem(STORAGE_KEY, value);
    });
  }

  toggleTheme(): void {
    this.theme.set(this.theme() === 'light' ? 'dark' : 'light');
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
  }

  private getInitialTheme(): Theme {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }

    // if the user never chose, respects the preference of the
    // sistema operativo/navegador
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    return prefersDark ? 'dark' : 'light';
  }
}