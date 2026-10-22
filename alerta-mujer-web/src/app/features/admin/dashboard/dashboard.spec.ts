import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminDashboardComponent } from './dashboard';

const alert = (fecha: Date) => ({ created_at: fecha.toISOString() }) as never;

describe('AdminDashboardComponent · tendencia por mes', () => {
  let c: AdminDashboardComponent;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 21, 12)); // 21 de octubre: semana 3 del mes
    TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    c = TestBed.createComponent(AdminDashboardComponent).componentInstance;
  });

  afterEach(() => vi.useRealTimers());

  it('agrupa por semanas del mes y compara con el mes anterior hasta el mismo día', () => {
    (c as unknown as { all: unknown[] }).all = [
      alert(new Date(2026, 9, 2)), // sem 1
      alert(new Date(2026, 9, 3)), // sem 1
      alert(new Date(2026, 9, 16)), // sem 3
      alert(new Date(2026, 8, 10)), // septiembre, sem 2
      alert(new Date(2026, 8, 25)), // septiembre, sem 4: después del día 21
    ];
    c.changeTrendView('mes');

    expect(c.monthTrend).toBe('octubre');
    expect(c.trendBars.map(b => b.day)).toEqual(['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5']);
    expect(c.trendBars.map(b => b.actual)).toEqual([2, 0, 1, null, null]);
    expect(c.trendBars.map(b => b.previous)).toEqual([0, 1, 0, 1, 0]);
    expect(c.trendBars[2].isToday).toBe(true);
    expect(c.currentTrendTotal).toBe(3);
    expect(c.previousTrendUntilToday).toBe(1);
    expect(c.trendSentence).toContain('2 alertas más que el mes pasado');

    c.changeTrendView('semana');
    expect(c.trendBars).toHaveLength(7);
  });
});
