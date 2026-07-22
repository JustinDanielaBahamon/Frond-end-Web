import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmergencyManagement } from './emergency-management';

describe('EmergencyManagement', () => {
  let component: EmergencyManagement;
  let fixture: ComponentFixture<EmergencyManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmergencyManagement],
    }).compileComponents();

    fixture = TestBed.createComponent(EmergencyManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
