// apps/web/src/entities/meal/api/supabase-meal.repository.ts — supabase-js 2.x
import { inject, Injectable } from '@angular/core';
import type { Json, Tables, TablesInsert } from '@tracker/db-types';
import { MEAL_SLOTS, sumMacros, type IsoDate } from '@tracker/domain';
import { SUPABASE } from '@web/shared/api';
import type { Meal, MealInput, MealItem, MealSlot, NutritionTargets } from '../model/meal.types';
import { MealRepository } from './meal.repository';

const COLUMNS = 'id, date, slot, title, items, kcal, protein_g, fat_g, carbs_g, source, note, created_at';

type Row = Omit<Tables<'meals'>, 'user_id'>;

const n = (v: unknown): number => {
  const x = Number(v); // numeric из Postgres может прийти строкой
  return Number.isFinite(x) && x >= 0 ? x : 0;
};

/** jsonb → MealItem[]: мусор отбрасываем, а не роняем экран */
export function parseItems(raw: unknown): MealItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
    .map((i) => ({
      name: typeof i['name'] === 'string' ? i['name'] : 'Без названия',
      grams: n(i['grams']),
      kcal: n(i['kcal']),
      protein: n(i['protein']),
      fat: n(i['fat']),
      carbs: n(i['carbs']),
    }));
}

const asSlot = (s: string): MealSlot => (MEAL_SLOTS as readonly string[]).includes(s) ? (s as MealSlot) : 'snack';

const toModel = (r: Row): Meal => ({
  id: r.id,
  date: r.date,
  slot: asSlot(r.slot),
  title: r.title,
  items: parseItems(r.items),
  totals: { kcal: n(r.kcal), protein: n(r.protein_g), fat: n(r.fat_g), carbs: n(r.carbs_g) },
  source: r.source === 'photo' ? 'photo' : 'manual',
  note: r.note,
  createdAt: r.created_at,
});

@Injectable()
export class SupabaseMealRepository extends MealRepository {
  private readonly sb = inject(SUPABASE);

  override async byDate(date: IsoDate): Promise<Meal[]> {
    const { data, error } = await this.sb.from('meals').select(COLUMNS).eq('date', date).order('created_at');
    if (error) throw new Error(error.message);
    return (data ?? []).map(toModel);
  }

  override async save(input: MealInput): Promise<Meal> {
    const t = sumMacros(input.items);
    const row: Omit<TablesInsert<'meals'>, 'user_id' | 'id'> = {
      date: input.date,
      slot: input.slot,
      title: input.title,
      items: input.items.map((i) => ({ ...i })) as unknown as Json,
      kcal: t.kcal,
      protein_g: t.protein,
      fat_g: t.fat,
      carbs_g: t.carbs,
      source: input.source,
      note: input.note,
    };
    const query = input.id
      ? this.sb.from('meals').update(row).eq('id', input.id)
      : this.sb.from('meals').insert(row);
    const { data, error } = await query.select(COLUMNS).single();
    if (error) throw new Error(error.message);
    return toModel(data);
  }

  override async remove(id: string): Promise<void> {
    const { error } = await this.sb.from('meals').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  override async targets(): Promise<NutritionTargets> {
    const { data, error } = await this.sb.from('profiles').select('kcal_target, protein_target_g').maybeSingle();
    if (error) throw new Error(error.message);
    return { kcal: data?.kcal_target ?? null, protein: data?.protein_target_g ?? null };
  }

  override async saveTargets(t: NutritionTargets): Promise<NutritionTargets> {
    // строки профиля может не быть — upsert; user_id подставит default auth.uid()
    const { data, error } = await this.sb
      .from('profiles')
      .upsert({ kcal_target: t.kcal, protein_target_g: t.protein }, { onConflict: 'user_id' })
      .select('kcal_target, protein_target_g')
      .single();
    if (error) throw new Error(error.message);
    return { kcal: data.kcal_target, protein: data.protein_target_g };
  }
}
