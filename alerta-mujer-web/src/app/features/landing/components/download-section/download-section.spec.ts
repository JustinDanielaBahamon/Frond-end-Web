import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DownloadSection } from './download-section';

describe('DownloadSection', () => {
  let component: DownloadSection;
  let fixture: ComponentFixture<DownloadSection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DownloadSection],
    }).compileComponents();

    fixture = TestBed.createComponent(DownloadSection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
