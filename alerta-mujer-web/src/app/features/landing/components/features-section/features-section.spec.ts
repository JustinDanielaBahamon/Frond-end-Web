import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeaturesSectionComponent } from './features-section';

describe('FeaturesSectionComponent', () => {
  let component: FeaturesSectionComponent;
  let fixture: ComponentFixture<FeaturesSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeaturesSectionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FeaturesSectionComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
