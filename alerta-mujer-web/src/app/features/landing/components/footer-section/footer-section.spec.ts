import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FooterSectionComopent } from './footer-section';

describe('FooterSectionComopent', () => {
  let component: FooterSectionComopent;
  let fixture: ComponentFixture<FooterSectionComopent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterSectionComopent],
    }).compileComponents();

    fixture = TestBed.createComponent(FooterSectionComopent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
