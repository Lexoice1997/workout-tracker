// libs/domain/src/schedule/week.spec.ts — Vitest
import { describe, expect, it } from 'vitest';
import { groupByWeek, weekEnd, weekStart } from './week';

describe('weekStart / weekEnd', () => {
  it('суббота 7 ноября → неделя 2–8 ноября', () => {
    expect(weekStart('2026-11-07')).toBe('2026-11-02');
    expect(weekEnd('2026-11-07')).toBe('2026-11-08');
  });
  it('понедельник — сам себе начало', () => expect(weekStart('2026-11-02')).toBe('2026-11-02'));
  it('воскресенье — конец своей недели, не начало следующей', () => expect(weekStart('2026-11-08')).toBe('2026-11-02'));
  it('через границу месяца', () => expect(weekStart('2026-11-01')).toBe('2026-10-26'));
});

describe('groupByWeek', () => {
  it('новые → старые, по неделям', () => {
    const dates = ['2026-11-07', '2026-11-03', '2026-10-31', '2026-10-27'];
    const groups = groupByWeek(dates, (d) => d);
    expect(groups.map((g) => [g.start, g.items])).toEqual([
      ['2026-11-02', ['2026-11-07', '2026-11-03']],
      ['2026-10-26', ['2026-10-31', '2026-10-27']],
    ]);
  });
  it('пусто — пусто', () => expect(groupByWeek([], (d: string) => d)).toEqual([]));
});
