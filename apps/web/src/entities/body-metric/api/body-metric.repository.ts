// apps/web/src/entities/body-metric/api/body-metric.repository.ts — контракт
import type { BodyMetric, BodyMetricInput } from '../model/body-metric.types';

export abstract class BodyMetricRepository {
  /** Все замеры, новые сверху */
  abstract list(): Promise<BodyMetric[]>;
  /** Один замер на дату: та же дата → перезапись (unique user_id, date) */
  abstract save(input: BodyMetricInput): Promise<BodyMetric>;
  abstract remove(id: string): Promise<void>;
}
