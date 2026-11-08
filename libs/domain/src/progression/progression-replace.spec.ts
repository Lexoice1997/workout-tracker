// libs/domain/src/progression/progression-replace.spec.ts — замена упражнения в слоте (вечер 8)
import { describe, expect, it } from 'vitest';
import type { PlanSlot, SetLog } from '../models';
import { nextPlan, relevantLast } from './progression';

const slot: PlanSlot = {
  id: 's1', dayId: 'd1', exerciseId: 'leg-press', name: 'Жим ногами',
  sets: 3, repMin: 10, repMax: 12, stepKg: 5, startKg: 120, isMain: false,
};
const log = (exerciseId: string, weightKg: number, reps: number[]): SetLog => ({
  id: 'l1', workoutId: 'w1', slotId: 's1', exerciseId, repMin: 10, repMax: 12, weightKg, reps,
});

describe('relevantLast', () => {
  it('то же упражнение — лог берётся', () => expect(relevantLast(slot, log('leg-press', 140, [12, 12, 12]))?.weightKg).toBe(140));
  it('упражнение заменили — лог игнорируется', () => expect(relevantLast(slot, log('hack', 80, [12, 12, 12]))).toBeNull());
  it('нет лога — null', () => expect(relevantLast(slot, null)).toBeNull());
});

describe('nextPlan после замены', () => {
  it('старт со start_kg, а не с веса старого упражнения', () => {
    expect(nextPlan(slot, log('hack', 80, [12, 12, 12]), false).weightKg).toBe(120);
  });
  it('без замены прогрессия как раньше: все подходы в верх → +шаг', () => {
    expect(nextPlan(slot, log('leg-press', 140, [12, 12, 12]), false).weightKg).toBe(145);
  });
  it('новый диапазон повторов: 12 при верхе 15 → держим', () => {
    expect(nextPlan({ ...slot, repMax: 15 }, log('leg-press', 140, [12, 12, 12]), false).weightKg).toBe(140);
  });
  it('подходов стало больше, чем в логе → держим', () => {
    expect(nextPlan({ ...slot, sets: 4 }, log('leg-press', 140, [12, 12, 12]), false).weightKg).toBe(140);
  });
});
