// apps/web/src/entities/body-metric/model/body-metric.types.ts
import type { BodyMetric, IsoDate } from '@tracker/domain';

/** Что отправляет форма: id нет — новая строка (или перезапись того же дня) */
export interface BodyMetricInput {
  readonly date: IsoDate;
  readonly weightKg: number | null;
  readonly waistCm: number | null;
  readonly chestCm: number | null;
  readonly bicepsRCm: number | null;
  readonly bicepsLCm: number | null;
}

export type { BodyMetric };
