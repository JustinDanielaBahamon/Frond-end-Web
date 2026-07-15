import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ForgotPhone } from './forgot-phone';

describe('ForgotPhone', () => {
  let component: ForgotPhone;
  let fixture: ComponentFixture<ForgotPhone>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPhone],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPhone);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
