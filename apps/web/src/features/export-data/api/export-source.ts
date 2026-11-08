// apps/web/src/features/export-data/api/export-source.ts — всё своё одним бандлом (RLS отдаёт только свои строки)
import { inject, Injectable } from '@angular/core';
import { SUPABASE } from '@web/shared/api';
import type { ExportBundle, ExportWorkout } from '../model/export';

const PAGE = 500; // PostgREST режет ответ по max-rows (в Supabase по умолчанию 1000) — читаем страницами

const num = (v: number | string | null): number | null => (v === null ? null : Number(v));

@Injectable({ providedIn: 'root' })
export class ExportSource {
  private readonly sb = inject(SUPABASE);

  async bundle(): Promise<ExportBundle> {
    // независимые запросы — параллельно
    const [workouts, body, goals, program] = await Promise.all([
      this.workouts(),
      this.sb.from('body_metrics').select('date, weight_kg, waist_cm, chest_cm, biceps_r_cm, biceps_l_cm').order('date'),
      this.sb.from('goals').select('target_kg, target_reps, deadline, achieved_at, exercises(name)').order('deadline'),
      this.sb
        .from('programs')
        .select('title, cycle_start, deload_every, program_days(code, title, weekday, sort, program_exercises(sort, sets, rep_min, rep_max, start_kg, step_kg, is_main, exercises(name)))')
        .eq('is_active', true)
        .not('user_id', 'is', null)
        .maybeSingle(),
    ]);
    for (const r of [body, goals, program]) if (r.error) throw new Error(r.error.message);
    return {
      app: 'workout-tracker',
      version: 1,
      exportedAt: new Date().toISOString(),
      workouts,
      bodyMetrics: body.data ?? [],
      goals: (goals.data ?? []).map(({ exercises, ...g }) => ({ exercise: exercises?.name ?? null, ...g })),
      program: program.data,
    };
  }

  private async workouts(): Promise<ExportWorkout[]> {
    const out: ExportWorkout[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.sb
        .from('workouts')
        .select('date, day_title, is_deload, cardio_min, note, finished_at, set_logs(weight_kg, reps, rep_min, rep_max, exercises(name), program_exercises(sort))')
        .order('date')
        .order('id') // стабильный порядок между страницами
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      for (const w of data ?? []) {
        out.push({
          date: w.date,
          day: w.day_title,
          isDeload: w.is_deload,
          cardioMin: w.cardio_min,
          note: w.note,
          finishedAt: w.finished_at,
          sets: [...w.set_logs]
            .sort((a, b) => (a.program_exercises?.sort ?? 99) - (b.program_exercises?.sort ?? 99))
            .map((s) => ({
              exercise: s.exercises?.name ?? 'Упражнение удалено',
              weightKg: num(s.weight_kg) ?? 0,
              reps: s.reps,
              repMin: s.rep_min,
              repMax: s.rep_max,
            })),
        });
      }
      if ((data?.length ?? 0) < PAGE) return out;
    }
  }
}
