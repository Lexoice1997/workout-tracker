// apps/web/src/shared/lib/iso-date.ts — арифметика над 'YYYY-MM-DD' в UTC.
// Всё в UTC специально: new Date('2026-11-08') в Ташкенте (UTC+5) + локальные геттеры = сдвиг на день.

export type Iso = string; // 'YYYY-MM-DD'

const parse = (iso: Iso): Date => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date): Iso => d.toISOString().slice(0, 10);

export const isIso = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s).getTime());

export function addDays(iso: Iso, days: number): Iso {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

/** +1 месяц от 31 января → 28/29 февраля, а не 3 марта */
export function addMonths(iso: Iso, months: number): Iso {
  const [y, m, day] = iso.split('-').map(Number) as [number, number, number];
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, last));
  return toIso(first);
}

/** 0 = понедельник … 6 = воскресенье */
export const weekdayMon0 = (iso: Iso): number => (parse(iso).getUTCDay() + 6) % 7;

export interface YearMonth {
  readonly y: number;
  readonly m: number; // 1–12
}

export const ymOf = (iso: Iso): YearMonth => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) });
export const firstOfMonth = ({ y, m }: YearMonth): Iso => `${y}-${String(m).padStart(2, '0')}-01`;
export const lastOfMonth = (ym: YearMonth): Iso => addDays(addMonths(firstOfMonth(ym), 1), -1);
export const shiftMonth = (ym: YearMonth, n: number): YearMonth => ymOf(addMonths(firstOfMonth(ym), n));

/** Недели месяца с понедельника; null — пустая клетка до 1-го и после последнего числа */
export function monthWeeks(ym: YearMonth): (Iso | null)[][] {
  const first = firstOfMonth(ym);
  const days = Number(lastOfMonth(ym).slice(8, 10));
  const cells: (Iso | null)[] = [
    ...Array.from({ length: weekdayMon0(first) }, () => null),
    ...Array.from({ length: days }, (_, i) => addDays(first, i)),
  ];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** Ограничить датой min/max (строки ISO сравниваются лексикографически корректно) */
export const clampIso = (iso: Iso, min: Iso | null, max: Iso | null): Iso =>
  min !== null && iso < min ? min : max !== null && iso > max ? max : iso;
