// libs/domain/src/schedule/week.ts — @tracker/domain: календарные недели для истории
import type { IsoDate } from '../models';
import { isoWeekday } from './pick-day';

const DAY_MS = 86_400_000;
const toIso = (ms: number): IsoDate => new Date(ms).toISOString().slice(0, 10); // ms — UTC-полночь, сдвига нет

/** Понедельник недели, в которую попадает дата */
export function weekStart(date: IsoDate): IsoDate {
  return toIso(Date.parse(date) - (isoWeekday(date) - 1) * DAY_MS);
}

/** Воскресенье той же недели */
export const weekEnd = (date: IsoDate): IsoDate => toIso(Date.parse(weekStart(date)) + 6 * DAY_MS);

export interface WeekGroup<T> {
  readonly start: IsoDate; // понедельник
  readonly end: IsoDate;   // воскресенье
  readonly items: readonly T[];
}

/** Группирует по неделям, сохраняя порядок входа (история приходит новые → старые) */
export function groupByWeek<T>(items: readonly T[], dateOf: (item: T) => IsoDate): WeekGroup<T>[] {
  const groups = new Map<IsoDate, T[]>();
  for (const item of items) {
    const key = weekStart(dateOf(item));
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return [...groups].map(([start, list]) => ({ start, end: weekEnd(start), items: list }));
}
