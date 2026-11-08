// apps/web/src/entities/program/api/program.repository.ts — контракт редактора программы
import type {
  CatalogExercise, CyclePatch, DayPatch, NewExercise, ProgramDay, ProgramSlot, ProgramTree, SlotPatch,
} from '../model/program.types';

export abstract class ProgramRepository {
  /** Активная программа: дни по порядку, в каждом слоты по порядку; null — программы нет */
  abstract active(): Promise<ProgramTree | null>;
  /** Каталог: общие упражнения + свои */
  abstract catalog(): Promise<CatalogExercise[]>;
  abstract updateSlot(id: string, patch: SlotPatch): Promise<ProgramSlot>;
  abstract addSlot(dayId: string, sort: number, patch: SlotPatch): Promise<ProgramSlot>;
  /** Подходы в истории остаются: set_logs.program_exercise_id → null (ON DELETE SET NULL) */
  abstract removeSlot(id: string): Promise<void>;
  /** Новый порядок слотов дня: [{id, sort}] */
  abstract reorder(items: readonly { readonly id: string; readonly sort: number }[]): Promise<void>;
  abstract createExercise(input: NewExercise): Promise<CatalogExercise>;
  abstract updateDay(id: string, patch: DayPatch): Promise<ProgramDay>;
  abstract addDay(programId: string, sort: number, patch: DayPatch): Promise<ProgramDay>;
  /** Слоты дня удаляются каскадом, тренировки остаются (workouts.day_id → null) */
  abstract removeDay(id: string): Promise<void>;
  abstract updateCycle(programId: string, patch: CyclePatch): Promise<void>;
}
