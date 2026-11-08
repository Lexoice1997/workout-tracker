// libs/domain/src/goals/goal-revision.ts — что предложить, если к цели не успеваешь
import type { IsoDate } from '../models';
import { e1rm, type Forecast, type Goal } from './goal-forecast';

const WEEK_MS = 7 * 86_400_000;

export interface Revision {
  /** Когда успеешь при текущем темпе (понедельник недели); null — темпа нет */
  readonly deadline: IsoDate | null;
  /** Какой вес на те же повторы успеешь к прежней дате; null — не меньше текущей цели или темпа нет */
  readonly targetKg: number | null;
}

/** Шаг округления цели: тяжёлые штанги — 2,5, лёгкое — 1 кг */
const stepFor = (kg: number) => (kg >= 50 ? 2.5 : 1);

/**
 * Только для status === 'behind'. Обе опции считаются из ФАКТИЧЕСКОГО темпа за ~4 недели:
 * дата — когда дойдёшь до цели; вес — куда дойдёшь к сроку.
 */
export function revision(goal: Goal, f: Forecast, currentE1rm: number, today: IsoDate): Revision | null {
  if (f.status !== 'behind') return null;
  const pace = f.actualPerWeek ?? 0;
  if (pace <= 0) return { deadline: null, targetKg: null }; // прогресса нет — цифрами помочь нечем

  const target = e1rm(goal.targetKg, goal.targetReps);
  const weeksToGoal = Math.ceil((target - currentE1rm) / pace);
  const due = new Date(Date.parse(today) + weeksToGoal * WEEK_MS);
  due.setUTCDate(due.getUTCDate() - ((due.getUTCDay() + 6) % 7)); // к понедельнику — даты целей круглее

  const weeksLeft = Math.max((Date.parse(goal.deadline) - Date.parse(today)) / WEEK_MS, 0);
  const reachable = (currentE1rm + pace * weeksLeft) / (1 + goal.targetReps / 30);
  const step = stepFor(goal.targetKg);
  const kg = Math.floor(reachable / step + 1e-9) * step;

  return {
    deadline: due.toISOString().slice(0, 10),
    targetKg: kg < goal.targetKg && kg > 0 ? Number(kg.toFixed(2)) : null,
  };
}
