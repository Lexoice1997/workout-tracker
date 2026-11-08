// apps/web/src/entities/body-metric/api/supabase-body-metric.repository.ts — supabase-js 2.x
import { inject, Injectable } from '@angular/core';
import type { Tables, TablesInsert } from '@tracker/db-types';
import { SUPABASE } from '@web/shared/api';
import type { BodyMetric, BodyMetricInput } from '../model/body-metric.types';
import { BodyMetricRepository } from './body-metric.repository';

const COLUMNS = 'id, date, weight_kg, waist_cm, chest_cm, biceps_r_cm, biceps_l_cm';

type Row = Omit<Tables<'body_metrics'>, 'user_id'>;

// numeric из Postgres может прийти строкой — приводим явно
const num = (v: number | string | null): number | null => (v === null ? null : Number(v));

const toModel = (r: Row): BodyMetric => ({
  id: r.id,
  date: r.date,
  weightKg: num(r.weight_kg),
  waistCm: num(r.waist_cm),
  chestCm: num(r.chest_cm),
  bicepsRCm: num(r.biceps_r_cm),
  bicepsLCm: num(r.biceps_l_cm),
});

@Injectable()
export class SupabaseBodyMetricRepository extends BodyMetricRepository {
  private readonly sb = inject(SUPABASE);

  override async list(): Promise<BodyMetric[]> {
    const { data, error } = await this.sb.from('body_metrics').select(COLUMNS).order('date', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toModel);
  }

  override async save(input: BodyMetricInput): Promise<BodyMetric> {
    // user_id не шлём: default auth.uid() подставится до проверки конфликта, RLS сверит его с токеном
    const row: Omit<TablesInsert<'body_metrics'>, 'user_id'> = {
      date: input.date,
      weight_kg: input.weightKg,
      waist_cm: input.waistCm,
      chest_cm: input.chestCm,
      biceps_r_cm: input.bicepsRCm,
      biceps_l_cm: input.bicepsLCm,
    };
    const { data, error } = await this.sb
      .from('body_metrics')
      .upsert(row, { onConflict: 'user_id,date' })
      .select(COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return toModel(data);
  }

  override async remove(id: string): Promise<void> {
    const { error } = await this.sb.from('body_metrics').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}
