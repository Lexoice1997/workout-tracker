// libs/domain/src/goals/goal-chart.spec.ts — vitest
import { describe, expect, it } from 'vitest';
import { deloadWeeks, goalChart, niceStep } from './goal-chart';

describe('niceStep', () => {
  it('1/2/2,5/5 × 10ⁿ', () => {
    expect(niceStep(20)).toBe(5);
    expect(niceStep(9)).toBe(2.5);
    expect(niceStep(3)).toBe(1);
    expect(niceStep(60)).toBe(20);
  });
});

describe('deloadWeeks', () => {
  it('цикл с 26.10, каждая 6-я неделя: 30.11, 11.01, 22.02…', () => {
    expect(deloadWeeks('2026-10-26', 6, '2026-10-26', '2027-03-01')).toEqual(['2026-11-30', '2027-01-11', '2027-02-22']);
  });
  it('только внутри окна', () => {
    expect(deloadWeeks('2026-10-26', 6, '2026-12-01', '2027-01-31')).toEqual(['2027-01-11']);
  });
});

describe('goalChart', () => {
  const base = { target: 128.3, deadline: '2027-05-01', today: '2026-11-08', cycle: { start: '2026-10-26', every: 6 } };

  it('одна точка: ось до недели дедлайна, траектория к цели, цель внутри Y', () => {
    const m = goalChart({ ...base, weekly: [{ week: '2026-11-02', e1rm: 108 }] });
    expect(m.from).toBe('2026-11-02');
    expect(m.to).toBe('2027-04-26');
    expect(m.path).toEqual({ from: { week: '2026-11-02', e1rm: 108 }, to: { week: '2027-04-26', e1rm: 128.3 } });
    expect(m.yMin).toBeLessThan(108);
    expect(m.yMax).toBeGreaterThanOrEqual(128.3);
    expect(m.yTicks.at(0)).toBe(m.yMin);
    expect(m.months[0]).toBe('2026-12-01');
    expect(m.deloads).toContain('2026-11-30');
  });

  it('цель достигнута — траектории нет', () => {
    expect(goalChart({ ...base, weekly: [{ week: '2026-11-02', e1rm: 130 }] }).path).toBeNull();
  });

  it('без данных — от текущей недели, без точек', () => {
    const m = goalChart({ ...base, weekly: [], cycle: null });
    expect(m.from).toBe('2026-11-02');
    expect(m.points).toEqual([]);
    expect(m.path).toBeNull();
    expect(m.deloads).toEqual([]);
  });

  it('дедлайн уже прошёл — ось всё равно не схлопывается', () => {
    const m = goalChart({ ...base, deadline: '2026-10-01', weekly: [{ week: '2026-11-02', e1rm: 100 }] });
    expect(m.to > m.from).toBe(true);
  });
});
