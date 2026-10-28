import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { heroComponent } from './hero';

describe('Hero', () => {
  let component: heroComponent;
  let fixture: ComponentFixture<heroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [heroComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(heroComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
