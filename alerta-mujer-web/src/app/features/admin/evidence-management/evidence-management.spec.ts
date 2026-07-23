import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EvidenceManagement } from './evidence-management';

describe('EvidenceManagement', () => {
  let component: EvidenceManagement;
  let fixture: ComponentFixture<EvidenceManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EvidenceManagement],
    }).compileComponents();

    fixture = TestBed.createComponent(EvidenceManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
