// libs/domain/src/progression/progression.spec.ts — Vitest
import { describe, expect, it } from 'vitest';
import { cycleWeek, isDeloadWeek, nextPlan } from './progression';
import type { PlanSlot, SetLog } from '../models';

const bench: PlanSlot = {
  id: 's1',
  dayId: 'd1',
  exerciseId: 'e1',
  name: 'Жим',
  sets: 4,
  repMin: 5,
  repMax: 6,
  stepKg: 2.5,
  startKg: 85,
  isMain: true,
};
const log = (reps: number[], weightKg = 85): SetLog => ({
  id: 'l1',
  workoutId: 'w1',
  slotId: 's1',
  exerciseId: 'e1',
  repMin: 5,
  repMax: 6,
  weightKg,
  reps,
});

describe('nextPlan', () => {
  it('без истории — стартовый вес', () =>
    expect(nextPlan(bench, null, false).weightKg).toBe(85));
  it('все подходы в верх → +шаг', () =>
    expect(nextPlan(bench, log([6, 6, 6, 6]), false).weightKg).toBe(87.5));
  it('один подход ниже верха → держим', () =>
    expect(nextPlan(bench, log([6, 6, 6, 5]), false).weightKg).toBe(85));
  it('недоделанные подходы → держим', () =>
    expect(nextPlan(bench, log([6, 6, 6]), false).weightKg).toBe(85));
  it('разгрузка: ×0,9 вниз к шагу, половина подходов', () =>
    expect(nextPlan(bench, log([6, 6, 6, 5]), true)).toEqual({
      weightKg: 75,
      sets: 2,
      isDeload: true,
    }));
});

describe('cycle', () => {
  it('5 декабря при старте 26 октября — 6-я неделя, разгрузка', () => {
    const week = cycleWeek('2026-10-26', '2026-12-05');
    expect(week).toBe(6);
    expect(isDeloadWeek(week, 6)).toBe(true);
  });
});
