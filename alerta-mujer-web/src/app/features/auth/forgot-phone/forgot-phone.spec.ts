import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ForgotPhoneComponent } from './forgot-phone';

describe('ForgotPhoneComponent', () => {
  let component: ForgotPhoneComponent;
  let fixture: ComponentFixture<ForgotPhoneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPhoneComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPhoneComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
