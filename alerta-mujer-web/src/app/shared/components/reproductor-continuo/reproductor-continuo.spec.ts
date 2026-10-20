import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { ParteGrabacion, ReproductorContinuoComponent } from './reproductor-continuo';

const parte = (id: number): ParteGrabacion => ({ id, url: `blob:parte-${id}`, creada: new Date(2026, 9, 20, 10, 0, id) });

describe('ReproductorContinuoComponent', () => {
  let fixture: ComponentFixture<ReproductorContinuoComponent>;
  let c: ReproductorContinuoComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReproductorContinuoComponent] }).compileComponents();
    fixture = TestBed.createComponent(ReproductorContinuoComponent);
    c = fixture.componentInstance;
    c.tipo = 'video';
    c.partes = [parte(1), parte(2), parte(3)];
    c.ngOnChanges({ partes: new SimpleChange(undefined, c.partes, true) });
  });

  it('al terminar una parte pasa a la siguiente y se detiene en la última', () => {
    c.alTerminar();
    expect(c.indice()).toBe(1);
    c.alTerminar();
    c.alTerminar();
    expect(c.indice()).toBe(2);
  });

  it('si llegan partes nuevas mientras suena una, sigue con la misma', () => {
    c.irA(1);
    const anteriores = c.partes;
    c.partes = [parte(1), parte(2), parte(3), parte(4)];
    c.ngOnChanges({ partes: new SimpleChange(anteriores, c.partes, false) });
    expect(c.indice()).toBe(1);
  });

  it('con otra grabación vuelve al inicio', () => {
    c.irA(2);
    const anteriores = c.partes;
    c.partes = [parte(7), parte(8)];
    c.ngOnChanges({ partes: new SimpleChange(anteriores, c.partes, false) });
    expect(c.indice()).toBe(0);
  });

  it('la barra muestra completas las partes ya escuchadas', () => {
    c.irA(2);
    expect(c.relleno(0)).toBe(100);
    expect(c.relleno(1)).toBe(100);
    expect(c.relleno(2)).toBe(0);
  });
});
