// libs/domain/src/schedule/pick-day.ts — @tracker/domain: какой день программы показать на экране «Сегодня»
import type { IsoDate, ProgramDay } from '../models';

/** ISO-день недели: 1 = Пн … 7 = Вс. Дата парсится как UTC-полночь — без сдвига поясов. */
export function isoWeekday(date: IsoDate): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Вс
  return d === 0 ? 7 : d;
}

export interface DayPick {
  readonly day: ProgramDay;
  readonly isToday: boolean; // false — сегодня отдых, показан ближайший следующий день
}

/**
 * Сегодня есть тренировка → она. Иначе — ближайшая следующая по неделе (после Сб → Вт).
 * Дни без weekday в автовыбор не попадают; если привязанных нет — первый по sort.
 */
export function pickDay(days: readonly ProgramDay[], date: IsoDate): DayPick | null {
  const today = isoWeekday(date);
  const scheduled = days.filter((d): d is ProgramDay & { weekday: number } => d.weekday !== null);

  if (scheduled.length === 0) {
    const first = days.at(0);
    return first ? { day: first, isToday: false } : null;
  }

  // расстояние вперёд по неделе: 0 — сегодня, 1 — завтра … 6
  const ahead = (w: number) => (w - today + 7) % 7;
  const next = scheduled.reduce((best, d) => (ahead(d.weekday) < ahead(best.weekday) ? d : best));
  return { day: next, isToday: next.weekday === today };
}
