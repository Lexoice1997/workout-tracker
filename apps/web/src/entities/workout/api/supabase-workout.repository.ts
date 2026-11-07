// apps/web/src/entities/workout/api/supabase-workout.repository.ts — реализация на supabase-js 2.x
import { inject, Injectable } from '@angular/core';
import type { ActiveProgram, IsoDate, PlanSlot, SetLog, Workout } from '@tracker/domain';
import { SUPABASE } from '@web/shared/api';
import {
  logRowToSetLog, toActiveProgram, toHistoryEntry, toPlanSlot, toSetLog, toSetLogInsert, toWorkout, toWorkoutInsert,
  type HistoryEntry,
} from '../lib/workout.mapper';
import { WorkoutRepository, type DayWorkout } from './workout.repository';

const LOG_COLUMNS = 'id, workout_id, program_exercise_id, exercise_id, rep_min, rep_max, weight_kg, reps';
const WORKOUT_COLUMNS = 'id, day_id, day_title, date, is_deload, cardio_min, note, finished_at';

@Injectable()
export class SupabaseWorkoutRepository extends WorkoutRepository {
  private readonly sb = inject(SUPABASE);

  override async activeProgram(): Promise<ActiveProgram | null> {
    const { data, error } = await this.sb
      .from('programs')
      .select('id, title, cycle_start, deload_every, program_days(id, code, title, weekday, sort)')
      .eq('is_active', true)
      .not('user_id', 'is', null) // шаблоны (user_id = null) RLS тоже отдаёт — их не берём
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toActiveProgram(data) : null;
  }

  override async slotsByDay(dayId: string): Promise<PlanSlot[]> {
    const { data, error } = await this.sb
      .from('program_exercises')
      .select('id, day_id, exercise_id, sets, rep_min, rep_max, step_kg, start_kg, is_main, exercises(name, default_step_kg)')
      .eq('day_id', dayId)
      .order('sort');
    if (error) throw new Error(error.message);
    return (data ?? []).map(toPlanSlot);
  }

  override async lastNormalLogs(slotIds: readonly string[]): Promise<SetLog[]> {
    if (slotIds.length === 0) return []; // пустой in() — лишний запрос
    const { data, error } = await this.sb
      .from('last_normal_set_logs')
      .select('*')
      .in('program_exercise_id', [...slotIds]);
    if (error) throw new Error(error.message);
    return (data ?? []).map(toSetLog).filter((l): l is SetLog => l !== null);
  }

  override async dayWorkout(dayId: string, date: IsoDate): Promise<DayWorkout | null> {
    const { data, error } = await this.sb
      .from('workouts')
      .select(`${WORKOUT_COLUMNS}, set_logs(${LOG_COLUMNS})`)
      .eq('day_id', dayId)
      .eq('date', date)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? { workout: toWorkout(data), logs: data.set_logs.map(logRowToSetLog) } : null;
  }

  override async saveSetLog(workout: Workout, log: SetLog): Promise<SetLog> {
    // 1) тренировка: создаём при первом подходе; если уже есть — ничего не трогаем (ON CONFLICT DO NOTHING)
    const w = await this.sb.from('workouts').upsert(toWorkoutInsert(workout), { onConflict: 'id', ignoreDuplicates: true });
    if (w.error) throw new Error(w.error.message);

    // 2) лог упражнения: тот же id → перезапись (кнопка «Изменить»)
    const { data, error } = await this.sb
      .from('set_logs')
      .upsert(toSetLogInsert(log), { onConflict: 'id' })
      .select(LOG_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return logRowToSetLog(data);
  }

  override async finishWorkout(workoutId: string, finish: { cardioMin: number | null; note: string | null }): Promise<Workout> {
    const { data, error } = await this.sb
      .from('workouts')
      .update({ cardio_min: finish.cardioMin, note: finish.note, finished_at: new Date().toISOString() })
      .eq('id', workoutId)
      .select(WORKOUT_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return toWorkout(data);
  }

  override async history(limit = 60): Promise<HistoryEntry[]> {
    const { data, error } = await this.sb
      .from('workouts')
      .select(`${WORKOUT_COLUMNS}, set_logs(${LOG_COLUMNS}, exercises(name), program_exercises(sort))`)
      .order('date', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map(toHistoryEntry);
  }

  override async deleteWorkout(workoutId: string): Promise<void> {
    const { error } = await this.sb.from('workouts').delete().eq('id', workoutId);
    if (error) throw new Error(error.message);
  }
}
