import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReviewComponent } from './review';

describe('ReviewComponent', () => {
  let component: ReviewComponent;
  let fixture: ComponentFixture<ReviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReviewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ReviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have 5 testimonials', () => {
    expect(component.testimonials.length).toBe(5);
  });

  it('usa avatares ilustrados propios y no fotos externas de personas reales', () => {
    for (const t of component.testimonials) {
      expect(t.image).toMatch(/^\/avatars\/[a-z-]+\.svg$/);
    }
  });

  it('should initialize with currentIndex 0', () => {
    expect(component.currentIndex).toBe(0);
  });

  it('should have testimonials with required properties', () => {
    const firstTestimonial = component.testimonials[0];
    expect(firstTestimonial.name).toBeDefined();
    expect(firstTestimonial.image).toBeDefined();
    expect(firstTestimonial.comment).toBeDefined();
  });

  it('should increment currentIndex on nextSlide', () => {
    const initialIndex = component.currentIndex;
    component.nextSlide();
    expect(component.currentIndex).toBeGreaterThan(initialIndex);
  });

  it('should set currentIndex on goToSlide', () => {
    component.goToSlide(2);
    expect(component.currentIndex).toBe(2);
  });
});