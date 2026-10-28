import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HowItWorksComponent } from './how-it-works';

describe('HowItWorksComponent', () => {
  let component: HowItWorksComponent;
  let fixture: ComponentFixture<HowItWorksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HowItWorksComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HowItWorksComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
