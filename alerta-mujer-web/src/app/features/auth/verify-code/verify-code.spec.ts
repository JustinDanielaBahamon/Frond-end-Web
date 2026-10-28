import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VerifyCodeComponent } from './verify-code';
import { RecoveryStateService } from '../../../core/services/recovery-state.service';

describe('VerifyCodeComponent', () => {
  let component: VerifyCodeComponent;
  let fixture: ComponentFixture<VerifyCodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerifyCodeComponent],
    }).compileComponents();

    TestBed.inject(RecoveryStateService).email.set('ana@correo.com');
    fixture = TestBed.createComponent(VerifyCodeComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
