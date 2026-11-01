// libs/domain/src/goals/goal-forecast.ts — @tracker/domain, чистый TS
import type { IsoDate } from '../models';

export interface Goal {
  readonly exerciseId: string;
  readonly targetKg: number;
  readonly targetReps: number;
  readonly deadline: IsoDate;
}

/** Лучший e1RM упражнения за неделю; разгрузочные недели сюда НЕ попадают. */
export interface WeeklyBest {
  readonly week: IsoDate;
  readonly e1rm: number;
}

export type GoalStatus = 'no-data' | 'reached' | 'on-track' | 'behind';

export interface Forecast {
  readonly status: GoalStatus;
  readonly requiredPerWeek: number; // кг e1RM в неделю, чтобы успеть к дедлайну
  readonly actualPerWeek: number | null; // фактический темп за ~4 недели
  readonly etaWeeks: number | null; // через сколько недель цель при текущем темпе
}

const WEEK_MS = 7 * 86_400_000;

/** Эпли: точна примерно до 10 повторов, дальше завышает. */
export const e1rm = (kg: number, reps: number): number => kg * (1 + reps / 30);

export function forecast(
  goal: Goal,
  history: readonly WeeklyBest[],
  today: IsoDate,
): Forecast {
  const target = e1rm(goal.targetKg, goal.targetReps);
  const last = history.at(-1);

  if (!last)
    return {
      status: 'no-data',
      requiredPerWeek: 0,
      actualPerWeek: null,
      etaWeeks: null,
    };
  if (last.e1rm >= target)
    return {
      status: 'reached',
      requiredPerWeek: 0,
      actualPerWeek: null,
      etaWeeks: 0,
    };

  const weeksLeft = Math.max(
    (Date.parse(goal.deadline) - Date.parse(today)) / WEEK_MS,
    1,
  );
  const requiredPerWeek = (target - last.e1rm) / weeksLeft;

  const recent = history.slice(-4);
  const first = recent.at(0);
  if (!first || recent.length < 3) {
    return {
      status: 'no-data',
      requiredPerWeek,
      actualPerWeek: null,
      etaWeeks: null,
    }; // темп ещё шум
  }

  const spanWeeks = (Date.parse(last.week) - Date.parse(first.week)) / WEEK_MS;
  const actualPerWeek =
    spanWeeks > 0 ? (last.e1rm - first.e1rm) / spanWeeks : 0;

  return {
    status: actualPerWeek >= requiredPerWeek * 0.9 ? 'on-track' : 'behind', // 10% допуск
    requiredPerWeek,
    actualPerWeek,
    etaWeeks: actualPerWeek > 0 ? (target - last.e1rm) / actualPerWeek : null,
  };
}
