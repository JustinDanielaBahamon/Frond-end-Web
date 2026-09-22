import { Injectable, signal, effect, inject } from '@angular/core';
import { ThemeService } from './theme.service';

const STORAGE_KEY = 'alerta-mujer-accent';
const DEFAULT_ACCENT = '#7c3aed'; // = --purple-deep original

interface Hsl { h: number; s: number; l: number; }

@Injectable({ providedIn: 'root' })
export class AccentColorService {
  private readonly themeService = inject(ThemeService);

  private readonly accent = signal<string>(this.getInitialAccent());
  readonly currentAccent = this.accent.asReadonly();

  constructor() {
    // se re-ejecuta si cambia el color O si cambia claro/oscuro,
    // para recalcular la rampa con luminosidades correctas
    effect(() => {
      const hex = this.accent();
      const theme = this.themeService.currentTheme();
      this.applyAccent(hex, theme);
      localStorage.setItem(STORAGE_KEY, hex);
    });
  }

  setAccent(hex: string): void {
    this.accent.set(hex);
  }

  private getInitialAccent(): string {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_ACCENT;
  }

  private applyAccent(hex: string, theme: 'light' | 'dark'): void {
    const { h, s } = this.hexToHsl(hex);
    const root = document.documentElement.style;
    const sat = this.clamp(s, 45, 75);

    if (theme === 'light') {
      root.setProperty('--purple-deep', this.hslToHex(h, sat, 48));
      root.setProperty('--purple-mid', this.hslToHex(h, sat - 5, 68));
      root.setProperty('--purple-light', this.hslToHex(h, sat - 10, 80));
      root.setProperty('--purple-pale', this.hslToHex(h, sat - 15, 93));
      root.setProperty('--purple-pale-hover', this.hslToHex(h, sat - 15, 89));
      root.setProperty('--pink', this.hslToHex((h + 320) % 360, this.clamp(sat + 5, 60, 85), 59));
      root.setProperty('--hero-accent', this.hslToHex(h, sat, 58));
      root.setProperty('--navbar-purple', this.hslToHex(h, sat, 44));
    } else {
      root.setProperty('--purple-deep', this.hslToHex(h, sat, 65));
      root.setProperty('--purple-mid', this.hslToHex(h, sat - 5, 72));
      root.setProperty('--purple-light', this.hslToHex(h, sat - 10, 45));
      root.setProperty('--purple-pale', this.hslToHex(h, sat - 15, 16));
      root.setProperty('--purple-pale-hover', this.hslToHex(h, sat - 15, 20));
      root.setProperty('--pink', this.hslToHex((h + 320) % 360, this.clamp(sat + 5, 60, 85), 68));
      root.setProperty('--hero-accent', this.hslToHex(h, sat, 72));
      root.setProperty('--navbar-purple', this.hslToHex(h, sat, 72));
    }
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, v));
  }

  private hexToHsl(hex: string): Hsl {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }

    return { h, s: s * 100, l: l * 100 };
  }

  private hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (h < 60)      { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else              { r = c; g = 0; b = x; }

    const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
}