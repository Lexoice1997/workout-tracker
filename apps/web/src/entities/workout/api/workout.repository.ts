// apps/web/src/entities/workout/api/workout.repository.ts — контракт: UI и сторы знают только его
import type { ActiveProgram, IsoDate, PlanSlot, SetLog, Workout } from '@tracker/domain';
import type { HistoryEntry } from '../lib/workout.mapper';

export interface DayWorkout {
  readonly workout: Workout;
  readonly logs: readonly SetLog[];
}

export abstract class WorkoutRepository {
  /** Активная программа пользователя с днями; null — программы нет */
  abstract activeProgram(): Promise<ActiveProgram | null>;
  /** Слоты дня с названиями из каталога, по порядку */
  abstract slotsByDay(dayId: string): Promise<PlanSlot[]>;
  /** Последний лог каждого слота вне разгрузочных недель */
  abstract lastNormalLogs(slotIds: readonly string[]): Promise<SetLog[]>;
  /** Тренировка этого дня программы на эту дату с уже записанными подходами; null — ещё не начинал */
  abstract dayWorkout(dayId: string, date: IsoDate): Promise<DayWorkout | null>;
  /** Создаёт тренировку при первом подходе (если её нет) и сохраняет/перезаписывает лог упражнения */
  abstract saveSetLog(workout: Workout, log: SetLog): Promise<SetLog>;
  /** Итог тренировки: кардио, заметка, отметка «завершена» */
  abstract finishWorkout(workoutId: string, finish: { cardioMin: number | null; note: string | null }): Promise<Workout>;
  /** Последние тренировки, новые сверху, с подходами и названиями упражнений */
  abstract history(limit?: number): Promise<HistoryEntry[]>;
  /** Удаляет тренировку; подходы удаляются каскадом */
  abstract deleteWorkout(workoutId: string): Promise<void>;
}
