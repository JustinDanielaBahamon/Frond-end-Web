import { Pipe, PipeTransform } from '@angular/core';

/**
 * Translation of the web. The Spanish text itself is the key: in Spanish it is shown as it is, and
 * public/i18n/{en,pt,fr}.json map it to the other languages (what is missing stays in Spanish).
 * The dictionary is loaded before the app starts; changing the language reloads the page.
 */
export type Language = 'es' | 'en' | 'pt' | 'fr';

let dictionary: Record<string, string> = {};

export async function loadTranslations(language: Language): Promise<void> {
  document.documentElement.lang = language;
  if (language === 'es') return;
  try {
    const response = await fetch(`/i18n/${language}.json`);
    if (response.ok) dictionary = await response.json();
  } catch {
    // Offline: the web stays in Spanish
  }
}

/** For texts built in the code (messages, labels). */
export function t(text: string): string {
  return dictionary[text] ?? text;
}

/**
 * In the templates: {{ 'Iniciar sesión' | t }}, and also {{ alert.status | t }}: a value that is not in
 * the dictionary (a name, an address, a number) is shown as it is.
 */
@Pipe({ name: 't' })
export class TPipe implements PipeTransform {
  transform<T>(value: T): T | string {
    return typeof value === 'string' ? t(value) : value;
  }
}
