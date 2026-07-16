import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'alerta-mujer-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {

  private readonly theme = signal<Theme>(this.getInitialTheme());

  // exponer como solo-lectura para que los componentes puedan
  // reaccionar al tema actual sin poder mutarlo directamente
  readonly currentTheme = this.theme.asReadonly();

  constructor() {
    // cada vez que theme cambie, aplica el atributo al <html>
    // y lo guarda para la próxima visita
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

    // si el usuario nunca eligió, respeta la preferencia del
    // sistema operativo/navegador
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }
}