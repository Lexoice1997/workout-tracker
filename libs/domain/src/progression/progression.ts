// libs/domain/src/progression/progression.ts — @tracker/domain, чистые функции
import type { IsoDate, PlanSlot, SetLog } from '../models';

export type Decision = 'add' | 'hold' | 'add-reps';

export interface Plan {
  readonly weightKg: number | null; // null — нет ни истории, ни start_kg
  readonly sets: number;
  readonly isDeload: boolean;
}

const DAY_MS = 86_400_000;

/** Неделя цикла с 1. 'YYYY-MM-DD' парсится как UTC-полночь, поэтому переход на летнее время не сдвигает счёт. */
export function cycleWeek(cycleStart: IsoDate, date: IsoDate): number {
  return (
    Math.floor((Date.parse(date) - Date.parse(cycleStart)) / DAY_MS / 7) + 1
  );
}

export const isDeloadWeek = (week: number, every: number): boolean =>
  week > 0 && week % every === 0;

/** 85 × 0,9 = 76,5 при шаге 2,5 → 75. toFixed убирает хвосты float. */
export function roundDownToStep(kg: number, step: number): number {
  return Number((Math.floor(kg / step + 1e-9) * step).toFixed(2));
}

export function decide(ex: PlanSlot, last: SetLog): Decision {
  const done = last.reps.slice(0, ex.sets);
  const allTop = done.length === ex.sets && done.every((r) => r >= ex.repMax);
  if (!allTop) return 'hold';
  return ex.stepKg === null ? 'add-reps' : 'add';
}

/** @param lastNormal последний лог слота вне разгрузочной недели */
export function nextPlan(
  ex: PlanSlot,
  lastNormal: SetLog | null,
  deload: boolean,
): Plan {
  const base = lastNormal
    ? lastNormal.weightKg +
      (decide(ex, lastNormal) === 'add' ? (ex.stepKg ?? 0) : 0)
    : ex.startKg;

  if (!deload) return { weightKg: base, sets: ex.sets, isDeload: false };

  return {
    weightKg:
      base === null ? null : roundDownToStep(base * 0.9, ex.stepKg ?? 0.5),
    sets: Math.ceil(ex.sets / 2),
    isDeload: true,
  };
}
