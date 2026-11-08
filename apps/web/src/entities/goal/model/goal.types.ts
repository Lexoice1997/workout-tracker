// apps/web/src/entities/goal/model/goal.types.ts
import type { DatedLog, Goal, IsoDate } from '@tracker/domain';

/** Цель с id строки и названием упражнения для UI */
export interface GoalItem {
  readonly id: string;
  readonly name: string;
  readonly goal: Goal;
}

export interface GoalInput {
  readonly id?: string; // нет — новая цель
  readonly exerciseId: string;
  readonly targetKg: number;
  readonly targetReps: number;
  readonly deadline: IsoDate;
}

export interface ExerciseOption {
  readonly id: string;
  readonly name: string;
}

/** Лог упражнения с датой тренировки — сырьё для weeklyBests() */
export interface ExerciseLog extends DatedLog {
  readonly exerciseId: string;
}
