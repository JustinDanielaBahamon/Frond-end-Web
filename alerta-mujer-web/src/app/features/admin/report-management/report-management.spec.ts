import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportManagementComponent } from './report-management';

describe('ReportManagement', () => {
  let component: ReportManagementComponent;
  let fixture: ComponentFixture<ReportManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportManagementComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportManagementComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
