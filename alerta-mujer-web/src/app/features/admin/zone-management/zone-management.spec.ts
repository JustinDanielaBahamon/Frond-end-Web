import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ZoneManagement } from './zone-management';

describe('ZoneManagement', () => {
  let component: ZoneManagement;
  let fixture: ComponentFixture<ZoneManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ZoneManagement],
    }).compileComponents();

    fixture = TestBed.createComponent(ZoneManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
