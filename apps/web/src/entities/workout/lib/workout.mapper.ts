// apps/web/src/entities/workout/lib/workout.mapper.ts — строки Supabase (snake_case, numeric) → доменные типы
import type { Tables, TablesInsert } from '@tracker/db-types';
import type { ActiveProgram, PlanSlot, ProgramDay, SetLog, Workout } from '@tracker/domain';

type DayRow = Pick<Tables<'program_days'>, 'id' | 'code' | 'title' | 'weekday' | 'sort'>;

export type ProgramRow = Pick<Tables<'programs'>, 'id' | 'title' | 'cycle_start' | 'deload_every'> & {
  readonly program_days: readonly DayRow[];
};

export type SlotRow = Pick<
  Tables<'program_exercises'>,
  'id' | 'day_id' | 'exercise_id' | 'sets' | 'rep_min' | 'rep_max' | 'step_kg' | 'start_kg' | 'is_main'
> & {
  readonly exercises: Pick<Tables<'exercises'>, 'name' | 'default_step_kg'> | null;
};

/** numeric из PostgREST может прийти и числом, и строкой — приводим явно */
const num = (v: number | string | null): number | null => (v === null ? null : Number(v));

const toDay = (r: DayRow): ProgramDay => ({ id: r.id, code: r.code, title: r.title, weekday: r.weekday, sort: r.sort });

export const toActiveProgram = (r: ProgramRow): ActiveProgram => ({
  id: r.id,
  title: r.title,
  cycleStart: r.cycle_start,
  deloadEvery: r.deload_every,
  days: [...r.program_days].sort((a, b) => a.sort - b.sort).map(toDay),
});

export const toPlanSlot = (r: SlotRow): PlanSlot => ({
  id: r.id,
  dayId: r.day_id,
  exerciseId: r.exercise_id,
  name: r.exercises?.name ?? 'Упражнение удалено из каталога',
  sets: r.sets,
  repMin: r.rep_min,
  repMax: r.rep_max,
  stepKg: num(r.step_kg) ?? num(r.exercises?.default_step_kg ?? null), // шаг слота важнее шага каталога
  startKg: num(r.start_kg),
  isMain: r.is_main,
});

/** Во view все колонки nullable — строки без ключевых полей отбрасываем */
export function toSetLog(r: Tables<'last_normal_set_logs'>): SetLog | null {
  if (!r.id || !r.workout_id || !r.exercise_id || r.weight_kg === null || !r.reps) return null;
  return {
    id: r.id,
    workoutId: r.workout_id,
    slotId: r.program_exercise_id,
    exerciseId: r.exercise_id,
    repMin: r.rep_min ?? 0,
    repMax: r.rep_max ?? 0,
    weightKg: Number(r.weight_kg),
    reps: r.reps,
  };
}

// --- Тренировка дня и сохранение подходов (вечер 4–5) ---

export type LogRow = Pick<
  Tables<'set_logs'>,
  'id' | 'workout_id' | 'program_exercise_id' | 'exercise_id' | 'rep_min' | 'rep_max' | 'weight_kg' | 'reps'
>;

export type WorkoutRow = Pick<
  Tables<'workouts'>,
  'id' | 'day_id' | 'day_title' | 'date' | 'is_deload' | 'cardio_min' | 'note' | 'finished_at'
>;

export const logRowToSetLog = (r: LogRow): SetLog => ({
  id: r.id,
  workoutId: r.workout_id,
  slotId: r.program_exercise_id,
  exerciseId: r.exercise_id,
  repMin: r.rep_min,
  repMax: r.rep_max,
  weightKg: Number(r.weight_kg),
  reps: r.reps,
});

export const toWorkout = (r: WorkoutRow): Workout => ({
  id: r.id,
  dayId: r.day_id,
  dayTitle: r.day_title,
  date: r.date,
  isDeload: r.is_deload,
  cardioMin: r.cardio_min,
  note: r.note,
  finishedAt: r.finished_at,
});

export const toWorkoutInsert = (w: Workout): TablesInsert<'workouts'> => ({
  id: w.id,
  day_id: w.dayId,
  day_title: w.dayTitle,
  date: w.date,
  is_deload: w.isDeload,
});

export const toSetLogInsert = (l: SetLog): TablesInsert<'set_logs'> => ({
  id: l.id,
  workout_id: l.workoutId,
  program_exercise_id: l.slotId,
  exercise_id: l.exerciseId,
  rep_min: l.repMin,
  rep_max: l.repMax,
  weight_kg: l.weightKg,
  reps: [...l.reps], // readonly → изменяемый массив для insert
});

// --- История (вечер 6) ---

export type HistoryLogRow = LogRow & {
  readonly exercises: Pick<Tables<'exercises'>, 'name'> | null;
  readonly program_exercises: Pick<Tables<'program_exercises'>, 'sort'> | null;
};

export type HistoryRow = WorkoutRow & { readonly set_logs: readonly HistoryLogRow[] };

export interface HistoryLog {
  readonly log: SetLog;
  readonly name: string;
}

export interface HistoryEntry {
  readonly workout: Workout;
  readonly logs: readonly HistoryLog[]; // в порядке программы
}

export const toHistoryEntry = (r: HistoryRow): HistoryEntry => ({
  workout: toWorkout(r),
  logs: [...r.set_logs]
    .sort((a, b) => (a.program_exercises?.sort ?? 99) - (b.program_exercises?.sort ?? 99)) // слот удалён — в конец
    .map((l) => ({ log: logRowToSetLog(l), name: l.exercises?.name ?? 'Упражнение удалено' })),
});
