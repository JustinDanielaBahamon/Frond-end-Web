import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FooterSectionComponent } from './footer-section';

describe('FooterSectionComopent', () => {
  let component: FooterSectionComponent;
  let fixture: ComponentFixture<FooterSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterSectionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FooterSectionComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
