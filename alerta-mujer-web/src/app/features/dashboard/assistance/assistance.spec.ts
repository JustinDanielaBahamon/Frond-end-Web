import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Assistance } from './assistance';

describe('Assistance', () => {
  let component: Assistance;
  let fixture: ComponentFixture<Assistance>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Assistance],
    }).compileComponents();

    fixture = TestBed.createComponent(Assistance);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
