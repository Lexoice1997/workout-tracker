// apps/web/src/entities/meal/api/meal.repository.ts — контракт
import type { IsoDate } from '@tracker/domain';
import type { Meal, MealInput, NutritionTargets } from '../model/meal.types';

export abstract class MealRepository {
  /** Приёмы пищи за день, по времени добавления */
  abstract byDate(date: IsoDate): Promise<Meal[]>;
  /** id null — insert, иначе update. Итоги КБЖУ считаются из items */
  abstract save(input: MealInput): Promise<Meal>;
  abstract remove(id: string): Promise<void>;
  abstract targets(): Promise<NutritionTargets>;
  abstract saveTargets(t: NutritionTargets): Promise<NutritionTargets>;
}
