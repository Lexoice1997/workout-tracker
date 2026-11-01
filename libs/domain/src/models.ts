// libs/domain/src/models.ts — @tracker/domain, без импортов Angular/Nest/Supabase
export type IsoDate = string; // 'YYYY-MM-DD' в поясе пользователя, НЕ new Date().toISOString()

/** Упражнение из каталога */
export interface Exercise {
  readonly id: string;
  readonly name: string;
  readonly equipment:
    | 'barbell'
    | 'dumbbell'
    | 'machine'
    | 'cable'
    | 'bodyweight';
  readonly defaultStepKg: number | null;
}

/** Слот: упражнение в дне программы. Прогрессия считается по слоту. */
export interface PlanSlot {
  readonly id: string;
  readonly dayId: string;
  readonly exerciseId: string;
  readonly name: string; // из каталога, для UI
  readonly sets: number;
  readonly repMin: number;
  readonly repMax: number;
  readonly stepKg: number | null; // уже с подставленным default_step_kg; null → прогрессия повторами
  readonly startKg: number | null;
  readonly isMain: boolean;
}

export interface SetLog {
  readonly id: string;
  readonly workoutId: string;
  readonly slotId: string | null; // null — слот удалили из программы
  readonly exerciseId: string;
  readonly repMin: number; // снимок диапазона для истории
  readonly repMax: number;
  readonly weightKg: number;
  readonly reps: readonly number[]; // [6, 6, 5, 5]
}

export interface Workout {
  readonly id: string;
  readonly dayId: string | null;
  readonly dayTitle: string;
  readonly date: IsoDate;
  readonly isDeload: boolean;
  readonly cardioMin: number | null;
}
