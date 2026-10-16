import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContactSectionCompoent } from './contact-section';

describe('ContactSectionCompoent', () => {
  let component: ContactSectionCompoent;
  let fixture: ComponentFixture<ContactSectionCompoent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactSectionCompoent],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactSectionCompoent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
