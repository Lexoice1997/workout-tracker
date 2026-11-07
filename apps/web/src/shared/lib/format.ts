// apps/web/src/shared/lib/format.ts — форматирование для UI (ru-RU: десятичная запятая)
const KG = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

/** 72.5 → «72,5» */
export const formatKg = (kg: number): string => KG.format(kg);

/** 4, 8, 10 → «4 × 8–10»; 3, 15, 15 → «3 × 15» */
export const formatScheme = (sets: number, repMin: number, repMax: number): string =>
  `${sets} × ${repMin === repMax ? repMin : `${repMin}–${repMax}`}`;

/** [6, 6, 6, 5] → «6 · 6 · 6 · 5» */
export const formatReps = (reps: readonly number[]): string => reps.join(' · ');

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

/** ISO 1–7 → «Пн»…«Вс» */
export const weekdayShort = (iso: number | null): string => (iso === null ? '—' : (WEEKDAYS_SHORT.at(iso - 1) ?? '—'));

const DATE_LABEL = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** '2026-11-07' → «сб, 7 ноября». UTC — потому что строка без времени и парсится как UTC-полночь */
export const formatDateLabel = (date: string): string => DATE_LABEL.format(new Date(`${date}T00:00:00Z`));

const DAY_MONTH = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const parts = (date: string) => DAY_MONTH.formatToParts(new Date(`${date}T00:00:00Z`));
const dayOf = (date: string) => parts(date).find((p) => p.type === 'day')?.value ?? '';

/** «2–8 ноября»; через месяц — «26 октября – 1 ноября» */
export function formatWeekRange(start: string, end: string): string {
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return sameMonth
    ? `${dayOf(start)}–${DAY_MONTH.format(new Date(`${end}T00:00:00Z`))}`
    : `${DAY_MONTH.format(new Date(`${start}T00:00:00Z`))} – ${DAY_MONTH.format(new Date(`${end}T00:00:00Z`))}`;
}
