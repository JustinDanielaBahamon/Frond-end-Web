import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DevicesManagement } from './devices-management';

describe('DevicesManagement', () => {
  let component: DevicesManagement;
  let fixture: ComponentFixture<DevicesManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DevicesManagement],
    }).compileComponents();

    fixture = TestBed.createComponent(DevicesManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
