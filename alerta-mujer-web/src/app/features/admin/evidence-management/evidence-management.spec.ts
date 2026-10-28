import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EvidencesManagementComponent } from './evidence-management';

describe('EvidencesManagementComponent', () => {
  let component: EvidencesManagementComponent;
  let fixture: ComponentFixture<EvidencesManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EvidencesManagementComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EvidencesManagementComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
