import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { RecordingPart, ContinuousPlayerComponent } from './continuous-player';

const part = (id: number): RecordingPart => ({ id, url: `blob:parte-${id}`, created: new Date(2026, 9, 20, 10, 0, id) });

describe('ReproductorContinuoComponent', () => {
  let fixture: ComponentFixture<ContinuousPlayerComponent>;
  let c: ContinuousPlayerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ContinuousPlayerComponent] }).compileComponents();
    fixture = TestBed.createComponent(ContinuousPlayerComponent);
    c = fixture.componentInstance;
    c.type = 'video';
    c.parts = [part(1), part(2), part(3)];
    c.ngOnChanges({ parts: new SimpleChange(undefined, c.parts, true) });
  });

  it('al terminar una parte pasa a la siguiente y se detiene en la última', () => {
    c.onEnd();
    expect(c.index()).toBe(1);
    c.onEnd();
    c.onEnd();
    expect(c.index()).toBe(2);
  });

  it('si llegan partes nuevas mientras suena una, sigue con la misma', () => {
    c.irA(1);
    const previousOnes = c.parts;
    c.parts = [part(1), part(2), part(3), part(4)];
    c.ngOnChanges({ parts: new SimpleChange(previousOnes, c.parts, false) });
    expect(c.index()).toBe(1);
  });

  it('con otra grabación vuelve al inicio', () => {
    c.irA(2);
    const previousOnes = c.parts;
    c.parts = [part(7), part(8)];
    c.ngOnChanges({ parts: new SimpleChange(previousOnes, c.parts, false) });
    expect(c.index()).toBe(0);
  });

  it('al cargar una parte toma su duración del elemento de video', () => {
    fixture.detectChanges();
    const video: HTMLVideoElement = fixture.nativeElement.querySelector('video');
    Object.defineProperty(video, 'duration', { configurable: true, value: 12 });

    c.onLoad();

    expect(c.durations()[1]).toBe(12);
  });

  it('la barra muestra completas las partes ya escuchadas', () => {
    c.irA(2);
    expect(c.fill(0)).toBe(100);
    expect(c.fill(1)).toBe(100);
    expect(c.fill(2)).toBe(0);
  });
});
