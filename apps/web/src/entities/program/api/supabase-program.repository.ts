// apps/web/src/entities/program/api/supabase-program.repository.ts — supabase-js 2.x
import { inject, Injectable } from '@angular/core';
import type { Tables, TablesUpdate } from '@tracker/db-types';
import { SUPABASE } from '@web/shared/api';
import type {
  CatalogExercise, CyclePatch, DayPatch, Equipment, NewExercise, ProgramDay, ProgramSlot, ProgramTree, SlotPatch,
} from '../model/program.types';
import { ProgramRepository } from './program.repository';

const SLOT_COLUMNS = 'id, day_id, exercise_id, sets, rep_min, rep_max, step_kg, start_kg, is_main, sort, exercises(name, default_step_kg)';

type SlotRow = Pick<
  Tables<'program_exercises'>,
  'id' | 'day_id' | 'exercise_id' | 'sets' | 'rep_min' | 'rep_max' | 'step_kg' | 'start_kg' | 'is_main' | 'sort'
> & { readonly exercises: Pick<Tables<'exercises'>, 'name' | 'default_step_kg'> | null };

type DayRow = Pick<Tables<'program_days'>, 'id' | 'code' | 'title' | 'weekday' | 'sort'> & {
  readonly program_exercises: readonly SlotRow[];
};

const num = (v: number | string | null): number | null => (v === null ? null : Number(v));
const bySort = <T extends { readonly sort: number }>(a: T, b: T) => a.sort - b.sort;

const DAY_COLUMNS = 'id, code, title, weekday, sort';
const toDay = (d: Pick<Tables<'program_days'>, 'id' | 'code' | 'title' | 'weekday' | 'sort'>): ProgramDay => ({
  id: d.id, code: d.code, title: d.title, weekday: d.weekday, sort: d.sort,
});

const slotRow = (patch: SlotPatch) => ({
  exercise_id: patch.exerciseId,
  sets: patch.sets,
  rep_min: patch.repMin,
  rep_max: patch.repMax,
  start_kg: patch.startKg,
  step_kg: patch.stepKg,
  is_main: patch.isMain,
});

const toSlot = (r: SlotRow): ProgramSlot => ({
  id: r.id,
  dayId: r.day_id,
  exerciseId: r.exercise_id,
  name: r.exercises?.name ?? 'Упражнение удалено из каталога',
  sets: r.sets,
  repMin: r.rep_min,
  repMax: r.rep_max,
  ownStepKg: num(r.step_kg),
  stepKg: num(r.step_kg) ?? num(r.exercises?.default_step_kg ?? null), // как в toPlanSlot: шаг слота важнее каталога
  startKg: num(r.start_kg),
  isMain: r.is_main,
  sort: r.sort,
});

@Injectable()
export class SupabaseProgramRepository extends ProgramRepository {
  private readonly sb = inject(SUPABASE);

  override async active(): Promise<ProgramTree | null> {
    const { data, error } = await this.sb
      .from('programs')
      .select(`id, title, cycle_start, deload_every, program_days(id, code, title, weekday, sort, program_exercises(${SLOT_COLUMNS}))`)
      .eq('is_active', true)
      .not('user_id', 'is', null) // шаблоны с user_id = null не берём
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const days = [...(data.program_days as readonly DayRow[])].sort(bySort); // сортируем на клиенте: вложенный order — лишняя магия
    return {
      id: data.id,
      title: data.title,
      cycleStart: data.cycle_start,
      deloadEvery: data.deload_every,
      days: days.map((d) => ({
        day: toDay(d),
        slots: [...d.program_exercises].sort(bySort).map(toSlot),
      })),
    };
  }

  override async catalog(): Promise<CatalogExercise[]> {
    const { data, error } = await this.sb.from('exercises').select('id, name, equipment, default_step_kg').order('name');
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      equipment: r.equipment as Equipment, // CHECK в БД гарантирует одно из пяти значений
      defaultStepKg: num(r.default_step_kg),
    }));
  }

  override async updateSlot(id: string, patch: SlotPatch): Promise<ProgramSlot> {
    const row: TablesUpdate<'program_exercises'> = slotRow(patch);
    const { data, error } = await this.sb.from('program_exercises').update(row).eq('id', id).select(SLOT_COLUMNS).single();
    if (error) throw new Error(error.message);
    return toSlot(data);
  }

  override async addSlot(dayId: string, sort: number, patch: SlotPatch): Promise<ProgramSlot> {
    // user_id не шлём: default auth.uid(); RLS проверит, что день — мой
    const { data, error } = await this.sb
      .from('program_exercises')
      .insert({ ...slotRow(patch), day_id: dayId, sort })
      .select(SLOT_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return toSlot(data);
  }

  override async removeSlot(id: string): Promise<void> {
    const { error } = await this.sb.from('program_exercises').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  override async reorder(items: readonly { readonly id: string; readonly sort: number }[]): Promise<void> {
    // upsert по id с частичными колонками превратился бы в INSERT с NOT NULL-ошибками → обычные update, параллельно
    const results = await Promise.all(items.map((i) => this.sb.from('program_exercises').update({ sort: i.sort }).eq('id', i.id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
  }

  override async createExercise(input: NewExercise): Promise<CatalogExercise> {
    const { data, error } = await this.sb
      .from('exercises')
      .insert({ name: input.name, equipment: input.equipment, default_step_kg: input.defaultStepKg })
      .select('id, name, equipment, default_step_kg')
      .single();
    if (error) throw new Error(error.code === '23505' ? 'Такое упражнение уже есть в каталоге' : error.message);
    return { id: data.id, name: data.name, equipment: data.equipment as Equipment, defaultStepKg: num(data.default_step_kg) };
  }

  override async updateDay(id: string, patch: DayPatch): Promise<ProgramDay> {
    const { data, error } = await this.sb
      .from('program_days')
      .update({ title: patch.title, weekday: patch.weekday })
      .eq('id', id)
      .select(DAY_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return toDay(data);
  }

  override async addDay(programId: string, sort: number, patch: DayPatch): Promise<ProgramDay> {
    const code = `day-${Date.now().toString(36)}`; // unique (program_id, code); человекочитаемый code не нужен
    const { data, error } = await this.sb
      .from('program_days')
      .insert({ program_id: programId, code, title: patch.title, weekday: patch.weekday, sort })
      .select(DAY_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return toDay(data);
  }

  override async removeDay(id: string): Promise<void> {
    const { error } = await this.sb.from('program_days').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  override async updateCycle(programId: string, patch: CyclePatch): Promise<void> {
    const { error } = await this.sb
      .from('programs')
      .update({ cycle_start: patch.cycleStart, deload_every: patch.deloadEvery })
      .eq('id', programId);
    if (error) throw new Error(error.message);
  }
}
