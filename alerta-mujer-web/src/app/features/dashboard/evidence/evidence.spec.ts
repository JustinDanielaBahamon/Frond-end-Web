import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Evidence } from './evidence';

describe('Evidence · mapa de la alerta', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [Evidence] });
  });

  afterEach(() => vi.useRealTimers());

  it('abre el mapa con el lugar de la alerta', () => {
    const fixture = TestBed.createComponent(Evidence);
    const c = fixture.componentInstance;
    fixture.detectChanges();
    c.alerts.set([{ id: 7, status: 'resolved', method: 'panic_button', start: new Date(2026, 9, 20), lat: 2.9273, lng: -75.2819, keep: false }]);
    c.alertId.set(7);

    c.openMap();
    fixture.detectChanges();
    vi.advanceTimersByTime(50);

    expect(fixture.nativeElement.querySelector('.ev-map.leaflet-container')).not.toBeNull();
  });
});
