import { ComponentFixture, TestBed } from '@angular/core/testing';

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
});
