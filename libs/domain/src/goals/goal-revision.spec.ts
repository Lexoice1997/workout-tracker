// libs/domain/src/goals/goal-revision.spec.ts — vitest
import { describe, expect, it } from 'vitest';
import type { Forecast, Goal } from './goal-forecast';
import { revision } from './goal-revision';

const goal: Goal = { exerciseId: 'bench', targetKg: 110, targetReps: 5, deadline: '2027-05-01' }; // e1RM ≈ 128,3
const behind = (actualPerWeek: number): Forecast => ({ status: 'behind', requiredPerWeek: 0.8, actualPerWeek, etaWeeks: null });

describe('revision', () => {
  it('не отстаёт — ничего не предлагаем', () => {
    expect(revision(goal, { status: 'on-track', requiredPerWeek: 0.8, actualPerWeek: 1, etaWeeks: 20 }, 110, '2026-12-07')).toBeNull();
  });

  it('темп 0,5 кг/нед: дата — через 37 недель (к понедельнику), вес — что успеешь к 1 мая', () => {
    const r = revision(goal, behind(0.5), 110, '2026-12-07')!;
    expect(r.deadline).toBe('2027-08-23'); // (128,33 − 110) / 0,5 = 36,7 → 37 нед. от 07.12 = 23.08 (пн)
    // к 01.05: 110 + 0,5 × 20,7 = 120,4 e1RM → / (1 + 5/30) = 103,2 → вниз к 2,5 = 102,5
    expect(r.targetKg).toBe(102.5);
  });

  it('лёгкое упражнение — шаг 1 кг', () => {
    const scott: Goal = { exerciseId: 'scott', targetKg: 42, targetReps: 8, deadline: '2027-05-01' };
    expect(revision(scott, behind(0.2), 40.5, '2026-12-07')!.targetKg).toBe(35);
  });

  it('прогресса нет — без цифр', () => {
    expect(revision(goal, behind(0), 110, '2026-12-07')).toEqual({ deadline: null, targetKg: null });
    expect(revision(goal, behind(-0.3), 110, '2026-12-07')).toEqual({ deadline: null, targetKg: null });
  });
});
