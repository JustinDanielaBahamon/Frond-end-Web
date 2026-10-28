import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModeratorManagementComponent } from './moderator-management';

describe('ModeratorManagementComponent', () => {
  let component: ModeratorManagementComponent;
  let fixture: ComponentFixture<ModeratorManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModeratorManagementComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ModeratorManagementComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
