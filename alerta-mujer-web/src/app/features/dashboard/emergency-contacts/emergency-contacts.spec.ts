import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmergencyContacts } from './emergency-contacts';

describe('EmergencyContacts', () => {
  let component: EmergencyContacts;
  let fixture: ComponentFixture<EmergencyContacts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmergencyContacts],
    }).compileComponents();

    fixture = TestBed.createComponent(EmergencyContacts);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
