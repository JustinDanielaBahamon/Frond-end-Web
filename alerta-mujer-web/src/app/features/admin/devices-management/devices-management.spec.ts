import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeviceManagementComponent } from './devices-management';

describe('DeviceManagementComponent', () => {
  let component: DeviceManagementComponent;
  let fixture: ComponentFixture<DeviceManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeviceManagementComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceManagementComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
