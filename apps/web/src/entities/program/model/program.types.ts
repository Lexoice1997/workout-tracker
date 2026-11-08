// apps/web/src/entities/program/model/program.types.ts
import type { PlanSlot, ProgramDay } from '@tracker/domain';

export type { ProgramDay };

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight';

export interface CatalogExercise {
  readonly id: string;
  readonly name: string;
  readonly equipment: Equipment;
  readonly defaultStepKg: number | null; // null — свой вес, прогрессия повторами
}

/** Слот для редактора: PlanSlot + то, что нужно знать, откуда взялся шаг */
export interface ProgramSlot extends PlanSlot {
  readonly sort: number;
  readonly ownStepKg: number | null; // step_kg слота; null — берётся шаг каталога (PlanSlot.stepKg уже итоговый)
}

export interface ProgramDayWithSlots {
  readonly day: ProgramDay;
  readonly slots: readonly ProgramSlot[];
}

export interface ProgramTree {
  readonly id: string;
  readonly title: string;
  readonly cycleStart: string | null;
  readonly deloadEvery: number;
  readonly days: readonly ProgramDayWithSlots[];
}

/** Своё упражнение, создаётся прямо из формы слота */
export interface NewExercise {
  readonly name: string;
  readonly equipment: Equipment;
  readonly defaultStepKg: number | null;
}

export interface DayPatch {
  readonly title: string;
  readonly weekday: number | null; // 1 = пн … 7 = вс
}

export interface CyclePatch {
  readonly cycleStart: string;
  readonly deloadEvery: number;
}

/** Что меняет форма слота */
export interface SlotPatch {
  readonly exerciseId: string;
  readonly sets: number;
  readonly repMin: number;
  readonly repMax: number;
  readonly startKg: number | null;
  readonly stepKg: number | null; // null — по каталогу
  readonly isMain: boolean;
  readonly newExercise?: NewExercise | null; // задано → сначала создать упражнение, exerciseId игнорируется
}
