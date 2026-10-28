import { TestBed } from '@angular/core/testing';
import * as Leaflet from 'leaflet';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AlertAdminComponent } from './alert-admin';

describe('AlertAdminComponent · mapa', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // In production Leaflet comes from the CDN script of index.html as the global L
    (globalThis as unknown as { L: typeof Leaflet }).L = Leaflet;
    TestBed.configureTestingModule({ imports: [AlertAdminComponent] });
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as unknown as { L?: typeof Leaflet }).L;
  });

  it('dibuja el mapa en su contenedor al abrir la gestión de alertas', () => {
    const fixture = TestBed.createComponent(AlertAdminComponent);
    fixture.detectChanges();

    expect(() => vi.advanceTimersByTime(150)).not.toThrow();
    expect(fixture.nativeElement.querySelector('.map.leaflet-container')).not.toBeNull();
  });
});
