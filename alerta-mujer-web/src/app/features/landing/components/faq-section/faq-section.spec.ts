import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FaqSection } from './faq-section';

describe('FaqSection', () => {
  let component: FaqSection;
  let fixture: ComponentFixture<FaqSection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FaqSection],
    }).compileComponents();

    fixture = TestBed.createComponent(FaqSection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
