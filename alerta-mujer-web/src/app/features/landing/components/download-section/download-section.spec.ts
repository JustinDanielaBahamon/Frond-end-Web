import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DownloadSectionComponent } from './download-section';

describe('DownloadSectionComponent', () => {
  let component: DownloadSectionComponent;
  let fixture: ComponentFixture<DownloadSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DownloadSectionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DownloadSectionComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
