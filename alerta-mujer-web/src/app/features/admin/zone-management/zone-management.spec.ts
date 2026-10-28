import { ComponentFixture, TestBed } from '@angular/core/testing';
import * as Leaflet from 'leaflet';
import { afterEach } from 'vitest';

import { ZoneManagementComponent } from './zone-management';

describe('ZoneManagementComponent', () => {
  let component: ZoneManagementComponent;
  let fixture: ComponentFixture<ZoneManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ZoneManagementComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ZoneManagementComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('mapa del modal', () => {
    // In production Leaflet comes from the CDN script of index.html as the global L
    beforeEach(() => { (globalThis as unknown as { L: typeof Leaflet }).L = Leaflet; });
    afterEach(() => { delete (globalThis as unknown as { L?: typeof Leaflet }).L; });

    it('al crear una zona muestra el mapa para ubicarla', () => {
      component.openCreate();

      expect(fixture.nativeElement.querySelector('.zone-map.leaflet-container')).not.toBeNull();
    });
  });
});
