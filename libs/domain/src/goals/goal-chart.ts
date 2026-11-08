// libs/domain/src/goals/goal-chart.ts — модель графика «e1RM по неделям → цель», без пикселей
import type { IsoDate } from '../models';
import { weekStart } from '../schedule/week';
import type { WeeklyBest } from './goal-forecast';

const WEEK_MS = 7 * 86_400_000;
const toIso = (ms: number): IsoDate => new Date(ms).toISOString().slice(0, 10);

export interface ChartPoint {
  readonly week: IsoDate; // понедельник
  readonly e1rm: number;
}

export interface GoalChartModel {
  readonly from: IsoDate;                 // ось X: неделя первой записи (или текущая)
  readonly to: IsoDate;                   // … до недели дедлайна
  readonly yMin: number;
  readonly yMax: number;
  readonly yTicks: readonly number[];
  readonly points: readonly ChartPoint[];
  readonly target: number;
  /** Нужная траектория: от последней точки к цели в дедлайн */
  readonly path: { readonly from: ChartPoint; readonly to: ChartPoint } | null;
  readonly deloads: readonly IsoDate[];   // понедельники разгрузочных недель внутри оси
  readonly months: readonly IsoDate[];    // 1-е числа месяцев внутри оси — подписи X
}

export interface GoalChartInput {
  readonly weekly: readonly WeeklyBest[];
  readonly target: number; // e1RM цели
  readonly deadline: IsoDate;
  readonly today: IsoDate;
  readonly cycle: { readonly start: IsoDate; readonly every: number } | null;
}

/** Шаг сетки 1/2/2,5/5 × 10ⁿ: 3–5 подписей на оси */
export function niceStep(range: number, maxTicks = 4): number {
  const raw = range / maxTicks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow);
}

/** Понедельники разгрузочных недель цикла в [from, to] */
export function deloadWeeks(cycleStart: IsoDate, every: number, from: IsoDate, to: IsoDate): IsoDate[] {
  const start = Date.parse(weekStart(cycleStart));
  const out: IsoDate[] = [];
  // первая разгрузка — неделя №every (с 1), дальше каждые every недель
  for (let ms = start + (every - 1) * WEEK_MS; ms <= Date.parse(to); ms += every * WEEK_MS) {
    if (ms >= Date.parse(from)) out.push(toIso(ms));
  }
  return out;
}

function monthStarts(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  const d = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  for (d.setUTCMonth(d.getUTCMonth() + 1); toIso(d.getTime()) <= to; d.setUTCMonth(d.getUTCMonth() + 1)) out.push(toIso(d.getTime()));
  return out;
}

export function goalChart({ weekly, target, deadline, today, cycle }: GoalChartInput): GoalChartModel {
  const points = weekly.map((w) => ({ week: w.week, e1rm: w.e1rm }));
  const from = points[0]?.week ?? weekStart(today);
  const to = weekStart(deadline) > from ? weekStart(deadline) : toIso(Date.parse(from) + 4 * WEEK_MS);
  const last = points.at(-1);

  const values = [target, ...points.map((p) => p.e1rm)];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const step = niceStep(Math.max(hi - lo, hi * 0.05)); // одна точка = цель → не делить на ноль
  const yMin = Math.floor((lo - step * 0.25) / step) * step;
  const yMax = Math.ceil((hi + step * 0.1) / step) * step;
  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += step) yTicks.push(Number(v.toFixed(2)));

  return {
    from,
    to,
    yMin,
    yMax,
    yTicks,
    points,
    target,
    path: last && last.e1rm < target ? { from: last, to: { week: to, e1rm: target } } : null,
    deloads: cycle ? deloadWeeks(cycle.start, cycle.every, from, to) : [],
    months: monthStarts(from, to),
  };
}
