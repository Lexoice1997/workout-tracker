// apps/web/src/entities/meal/model/meal.types.ts
import type { IsoDate, Meal, MealItem, MealSlot, NutritionTargets } from '@tracker/domain';

/** Что отправляет форма: итоги считает репозиторий из items */
export interface MealInput {
  readonly id: string | null; // null — новый приём пищи
  readonly date: IsoDate;
  readonly slot: MealSlot;
  readonly title: string;
  readonly items: readonly MealItem[];
  readonly source: 'photo' | 'manual'; // photo — записал Claude через коннектор meal-mcp
  readonly note: string | null;
}

export type { Meal, MealItem, MealSlot, NutritionTargets };
