import { describe, expect, it } from 'vitest';
import { compactPages } from './paginacion';

describe('paginasCompactas', () => {
  it('muestra todas cuando son pocas', () => {
    expect(compactPages(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(compactPages(1, 0)).toEqual([1]);
  });

  it('abrevia al principio, en medio y al final', () => {
    expect(compactPages(1, 24)).toEqual([1, 2, 3, 4, 5, null, 24]);
    expect(compactPages(9, 24)).toEqual([1, null, 8, 9, 10, null, 24]);
    expect(compactPages(24, 24)).toEqual([1, null, 20, 21, 22, 23, 24]);
  });

  it('la página actual siempre aparece', () => {
    for (let p = 1; p <= 30; p++) expect(compactPages(p, 30)).toContain(p);
  });
});
