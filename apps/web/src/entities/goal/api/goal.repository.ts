// apps/web/src/entities/goal/api/goal.repository.ts — контракт
import type { IsoDate } from '@tracker/domain';
import type { ExerciseLog, ExerciseOption, GoalInput, GoalItem, TrainingCycle } from '../model/goal.types';

export abstract class GoalRepository {
  /** Активные цели (achieved_at is null) с названиями упражнений */
  abstract activeGoals(): Promise<GoalItem[]>;
  /** Каталог: общий + свои упражнения — для выбора при новой цели */
  abstract exercises(): Promise<ExerciseOption[]>;
  /** Логи упражнений с даты, БЕЗ разгрузочных недель */
  abstract logs(exerciseIds: readonly string[], since: IsoDate): Promise<ExerciseLog[]>;
  /** Цикл активной программы (старт и частота разгрузки); null — программы нет или старт не задан */
  abstract cycle(): Promise<TrainingCycle | null>;
  abstract save(input: GoalInput): Promise<GoalItem>;
  abstract remove(id: string): Promise<void>;
}
