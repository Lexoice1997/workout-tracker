// libs/domain/src/goals/weekly-best.ts — @tracker/domain: из подходов → лучший e1RM по неделям
import type { IsoDate } from '../models';
import { weekStart } from '../schedule/week';
import { e1rm, type WeeklyBest } from './goal-forecast';

/** Один записанный лог упражнения (все подходы) с датой тренировки */
export interface DatedLog {
  readonly date: IsoDate;
  readonly weightKg: number;
  readonly reps: readonly number[];
}

/** Лучший подход лога: при одном весе это подход с максимумом повторов */
export const bestE1rm = (log: DatedLog): number =>
  log.reps.reduce((best, r) => Math.max(best, r > 0 ? e1rm(log.weightKg, r) : 0), 0);

/**
 * Лучший e1RM за каждую неделю, по возрастанию недель.
 * Разгрузку фильтруй ДО вызова: её веса занижены и испортят темп.
 * Логи без веса (свой вес, weightKg = 0) пропускаются — e1RM для них не имеет смысла.
 */
export function weeklyBests(logs: readonly DatedLog[]): WeeklyBest[] {
  const byWeek = new Map<IsoDate, number>();
  for (const log of logs) {
    if (log.weightKg <= 0) continue;
    const week = weekStart(log.date);
    byWeek.set(week, Math.max(byWeek.get(week) ?? 0, bestE1rm(log)));
  }
  return [...byWeek]
    .map(([week, best]) => ({ week, e1rm: Number(best.toFixed(1)) }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

/** Самый свежий лог по дате */
export const latestLog = <T extends DatedLog>(logs: readonly T[]): T | null =>
  logs.reduce<T | null>((acc, l) => (!acc || l.date > acc.date ? l : acc), null);

/**
 * Лучший лог последней недели — для крупной цифры «сейчас: 92,5 × 6».
 * Не «последний по дате»: после тяжёлой субботы объёмный вторник (72,5 × 10) выглядел бы как откат.
 */
export function bestOfLatestWeek<T extends DatedLog>(logs: readonly T[]): T | null {
  const last = latestLog(logs.filter((l) => l.weightKg > 0));
  if (!last) return latestLog(logs); // только свой вес — просто последний
  const week = weekStart(last.date);
  return logs
    .filter((l) => l.weightKg > 0 && weekStart(l.date) === week)
    .reduce((best, l) => (bestE1rm(l) > bestE1rm(best) ? l : best), last);
}

export interface ProgressSeries<T extends DatedLog> {
  readonly weekly: readonly WeeklyBest[]; // для forecast()
  readonly current: T | null;             // крупная цифра на карточке
}

/**
 * Ряд для прогноза с учётом недели, которая ещё идёт.
 * Текущая неделя берётся, только если она УЖЕ не хуже прошлой: рекорд в субботу виден сразу,
 * а во вторник (только объёмный день) неделя не тянет темп вниз.
 */
export function progressSeries<T extends DatedLog>(logs: readonly T[], today: IsoDate): ProgressSeries<T> {
  const weekly = weeklyBests(logs);
  const last = weekly.at(-1);
  const prev = weekly.at(-2);
  const thisWeek = weekStart(today);
  const partialAndWorse = last !== undefined && prev !== undefined && last.week === thisWeek && last.e1rm < prev.e1rm;
  if (!partialAndWorse) return { weekly, current: bestOfLatestWeek(logs) };
  return {
    weekly: weekly.slice(0, -1),
    current: bestOfLatestWeek(logs.filter((l) => weekStart(l.date) !== thisWeek)),
  };
}
