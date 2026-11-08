// apps/web/src/entities/goal/api/supabase-goal.repository.ts — supabase-js 2.x
import { inject, Injectable } from '@angular/core';
import type { Tables } from '@tracker/db-types';
import type { IsoDate } from '@tracker/domain';
import { SUPABASE } from '@web/shared/api';
import { uuid } from '@web/shared/lib/uuid';
import type { ExerciseLog, ExerciseOption, GoalInput, GoalItem, TrainingCycle } from '../model/goal.types';
import { GoalRepository } from './goal.repository';

const GOAL_COLUMNS = 'id, exercise_id, target_kg, target_reps, deadline, exercises(name)';

type GoalRow = Pick<Tables<'goals'>, 'id' | 'exercise_id' | 'target_kg' | 'target_reps' | 'deadline'> & {
  readonly exercises: Pick<Tables<'exercises'>, 'name'> | null;
};

const toGoalItem = (r: GoalRow): GoalItem => ({
  id: r.id,
  name: r.exercises?.name ?? 'Упражнение удалено',
  goal: { exerciseId: r.exercise_id, targetKg: Number(r.target_kg), targetReps: r.target_reps, deadline: r.deadline },
});

@Injectable()
export class SupabaseGoalRepository extends GoalRepository {
  private readonly sb = inject(SUPABASE);

  override async activeGoals(): Promise<GoalItem[]> {
    const { data, error } = await this.sb.from('goals').select(GOAL_COLUMNS).is('achieved_at', null).order('deadline');
    if (error) throw new Error(error.message);
    return (data ?? []).map(toGoalItem);
  }

  override async exercises(): Promise<ExerciseOption[]> {
    const { data, error } = await this.sb.from('exercises').select('id, name').order('name');
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  override async logs(exerciseIds: readonly string[], since: IsoDate): Promise<ExerciseLog[]> {
    if (exerciseIds.length === 0) return [];
    const { data, error } = await this.sb
      .from('set_logs')
      .select('exercise_id, weight_kg, reps, workouts!inner(date, is_deload)') // !inner: фильтр по тренировке отсекает строки
      .in('exercise_id', [...exerciseIds])
      .eq('workouts.is_deload', false) // разгрузка занижает веса и ломает темп
      .gte('workouts.date', since);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      exerciseId: r.exercise_id,
      date: r.workouts.date,
      weightKg: Number(r.weight_kg),
      reps: r.reps,
    }));
  }

  override async cycle(): Promise<TrainingCycle | null> {
    const { data, error } = await this.sb
      .from('programs')
      .select('cycle_start, deload_every')
      .eq('is_active', true)
      .not('user_id', 'is', null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.cycle_start ? { start: data.cycle_start, every: data.deload_every } : null;
  }

  override async save(input: GoalInput): Promise<GoalItem> {
    const { data, error } = await this.sb
      .from('goals')
      .upsert(
        {
          id: input.id ?? uuid(),
          exercise_id: input.exerciseId,
          target_kg: input.targetKg,
          target_reps: input.targetReps,
          deadline: input.deadline,
        },
        { onConflict: 'id' },
      )
      .select(GOAL_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return toGoalItem(data);
  }

  override async remove(id: string): Promise<void> {
    const { error } = await this.sb.from('goals').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}
