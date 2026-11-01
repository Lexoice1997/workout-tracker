import { describe, expect, it } from 'vitest';
import { e1rm, forecast, type Goal, type WeeklyBest } from './goal-forecast';

const bench: Goal = {
  exerciseId: 'e1',
  targetKg: 110,
  targetReps: 5,
  deadline: '2027-05-01',
};
const week = (date: string, kg: number, reps: number): WeeklyBest => ({
  week: date,
  e1rm: e1rm(kg, reps),
});

describe('forecast', () => {
  it('нет истории — no-data', () =>
    expect(forecast(bench, [], '2026-11-02').status).toBe('no-data'));

  it('меньше 3 недель — темп не считаем, но «нужно» уже есть', () => {
    const f = forecast(bench, [week('2026-10-31', 85, 6)], '2026-11-02');
    expect(f.status).toBe('no-data');
    expect(f.requiredPerWeek).toBeCloseTo(1, 1); // (128,3 − 102) / ~25,7 нед
  });

  it('растёт быстрее нужного — on-track', () => {
    const h = [
      week('2026-10-31', 85, 6),
      week('2026-11-07', 87.5, 6),
      week('2026-11-14', 90, 6),
    ];
    expect(forecast(bench, h, '2026-11-15').status).toBe('on-track');
  });

  it('стоит на месте — behind', () => {
    const h = [
      week('2026-10-31', 85, 6),
      week('2026-11-07', 85, 6),
      week('2026-11-14', 85, 5),
    ];
    expect(forecast(bench, h, '2026-11-15').status).toBe('behind');
  });

  it('цель уже взята — reached', () =>
    expect(
      forecast(bench, [week('2027-03-01', 110, 5)], '2027-03-02').status,
    ).toBe('reached'));
});
