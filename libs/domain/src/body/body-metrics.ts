// libs/domain/src/body/body-metrics.ts — @tracker/domain: замеры тела, чистый TS
import type { IsoDate } from '../models';

export interface BodyMetric {
  readonly id: string;
  readonly date: IsoDate;
  readonly weightKg: number | null;
  readonly waistCm: number | null;
  readonly chestCm: number | null;
  readonly bicepsRCm: number | null;
  readonly bicepsLCm: number | null;
}

export type BodyField = 'weightKg' | 'waistCm' | 'chestCm' | 'bicepsRCm' | 'bicepsLCm';

export const BODY_FIELDS: readonly BodyField[] = ['weightKg', 'waistCm', 'chestCm', 'bicepsRCm', 'bicepsLCm'];

/** Хорошее направление: живот вниз, грудь и бицепс вверх, вес — нейтрально (при рекомпозиции стоит) */
export const GOOD_DIRECTION: Readonly<Record<BodyField, -1 | 0 | 1>> = {
  weightKg: 0,
  waistCm: -1,
  chestCm: 1,
  bicepsRCm: 1,
  bicepsLCm: 1,
};

export type Verdict = 'better' | 'worse' | 'same' | 'neutral';

export interface FieldChange {
  readonly field: BodyField;
  readonly value: number | null; // из последнего замера; null — в нём это не мерили
  readonly delta: number | null; // к прошлому замеру, где поле было
  readonly verdict: Verdict | null;
}

export interface GapTrend {
  readonly now: number;
  readonly delta: number | null; // к самому первому замеру с грудью и животом
  readonly since: IsoDate | null;
}

export interface BodySummary {
  readonly latest: BodyMetric | null;
  readonly fields: readonly FieldChange[];
  readonly gap: GapTrend | null;
  readonly nextDue: IsoDate | null;
  readonly overdue: boolean;
}

const round1 = (n: number): number => Math.round(n * 10) / 10; // 104 − 103.7 = 0.29999… → 0.3

/** Грудь − живот: растёт при рекомпозиции, даже если вес стоит */
export const chestWaistGap = (m: BodyMetric): number | null =>
  m.chestCm !== null && m.waistCm !== null ? round1(m.chestCm - m.waistCm) : null;

export function verdict(field: BodyField, delta: number): Verdict {
  if (delta === 0) return 'same';
  const dir = GOOD_DIRECTION[field];
  if (dir === 0) return 'neutral';
  return Math.sign(delta) === dir ? 'better' : 'worse';
}

/** '2026-11-01' + 1 мес → '2026-12-01'; 31 января → 28/29 февраля (не 3 марта, как у Date) */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, lastDay));
  return first.toISOString().slice(0, 10);
}

/** По возрастанию даты; исходный массив не трогаем */
const byDateAsc = (items: readonly BodyMetric[]): BodyMetric[] => [...items].sort((a, b) => a.date.localeCompare(b.date));

function fieldChange(asc: readonly BodyMetric[], field: BodyField): FieldChange {
  const latest = asc.at(-1);
  const value = latest?.[field] ?? null;
  if (value === null) return { field, value: null, delta: null, verdict: null };
  // замер может быть неполным → ищем ближайший прошлый, где поле есть
  const prev = asc.slice(0, -1).reverse().find((m) => m[field] !== null)?.[field] ?? null;
  if (prev === null) return { field, value, delta: null, verdict: null };
  const delta = round1(value - prev);
  return { field, value, delta, verdict: verdict(field, delta) };
}

function gapTrend(asc: readonly BodyMetric[]): GapTrend | null {
  const latest = asc.at(-1);
  const now = latest ? chestWaistGap(latest) : null;
  if (now === null) return null;
  const base = asc.slice(0, -1).find((m) => chestWaistGap(m) !== null);
  const baseGap = base ? chestWaistGap(base) : null;
  return base && baseGap !== null
    ? { now, delta: round1(now - baseGap), since: base.date }
    : { now, delta: null, since: null };
}

/** Всё для экрана «Замеры» одним вызовом. Порядок items не важен. */
export function bodySummary(items: readonly BodyMetric[], today: IsoDate, everyMonths = 1): BodySummary {
  const asc = byDateAsc(items);
  const latest = asc.at(-1) ?? null;
  const nextDue = latest ? addMonths(latest.date, everyMonths) : null;
  return {
    latest,
    fields: BODY_FIELDS.map((f) => fieldChange(asc, f)),
    gap: gapTrend(asc),
    nextDue,
    overdue: nextDue !== null && today > nextDue,
  };
}
