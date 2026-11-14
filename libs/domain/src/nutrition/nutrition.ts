// libs/domain/src/nutrition/nutrition.ts — @tracker/domain: питание, чистый TS
import type { IsoDate } from '../models';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Продукт в приёме пищи: КБЖУ на указанные граммы, не на 100 г */
export interface MealItem {
  readonly name: string;
  readonly grams: number;
  readonly kcal: number;
  readonly protein: number;
  readonly fat: number;
  readonly carbs: number;
}

export interface Macros {
  readonly kcal: number;
  readonly protein: number;
  readonly fat: number;
  readonly carbs: number;
}

export interface Meal {
  readonly id: string;
  readonly date: IsoDate;
  readonly slot: MealSlot;
  readonly title: string;
  readonly items: readonly MealItem[];
  readonly totals: Macros;
  readonly source: 'photo' | 'manual';
  readonly note: string | null;
  readonly createdAt: string;
}

export interface NutritionTargets {
  readonly kcal: number | null;
  readonly protein: number | null;
}

const r1 = (n: number): number => Math.round(n * 10) / 10;
const ZERO: Macros = { kcal: 0, protein: 0, fat: 0, carbs: 0 };

/** Сумма КБЖУ с округлением до 0,1 — под numeric(…,1) в БД */
export function sumMacros(list: readonly Macros[]): Macros {
  const s = list.reduce(
    (a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein, fat: a.fat + m.fat, carbs: a.carbs + m.carbs }),
    ZERO,
  );
  return { kcal: r1(s.kcal), protein: r1(s.protein), fat: r1(s.fat), carbs: r1(s.carbs) };
}

/**
 * Поменяли граммы — КБЖУ пропорционально. Claude чаще ошибается в порции, чем в составе,
 * поэтому правка веса — главная правка. 0 г или пустая строка у исходника → без масштаба.
 */
export function scaleItem(item: MealItem, grams: number): MealItem {
  if (item.grams <= 0 || grams < 0) return { ...item, grams: Math.max(0, grams) };
  const k = grams / item.grams;
  return {
    ...item,
    grams,
    kcal: r1(item.kcal * k),
    protein: r1(item.protein * k),
    fat: r1(item.fat * k),
    carbs: r1(item.carbs * k),
  };
}

/** Проверка КБЖУ на здравый смысл: 4/4/9 ккал на грамм. Расхождение > 25% — повод перепроверить */
export function kcalFromMacros(m: Omit<Macros, 'kcal'>): number {
  return r1(m.protein * 4 + m.fat * 9 + m.carbs * 4);
}

export function macrosLookOff(m: Macros): boolean {
  const calc = kcalFromMacros(m);
  if (m.kcal < 50 && calc < 50) return false; // чай, огурец — шум
  return Math.abs(calc - m.kcal) / Math.max(m.kcal, calc) > 0.25;
}

/** Слот по времени суток: до 11 — завтрак, до 16 — обед, после 18 — ужин, между — перекус */
export function slotByHour(hour: number): MealSlot {
  if (hour >= 4 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 18 && hour < 23) return 'dinner';
  return 'snack';
}

export interface Progress {
  readonly value: number;
  readonly target: number | null;
  readonly left: number | null;  // > 0 — осталось, < 0 — перебор
  readonly ratio: number | null; // 0…∞ для полосы
}

const progress = (value: number, target: number | null): Progress => ({
  value,
  target,
  left: target === null ? null : r1(target - value),
  ratio: target === null || target === 0 ? null : value / target,
});

export interface DaySummary {
  readonly totals: Macros;
  readonly kcal: Progress;
  readonly protein: Progress;
  readonly bySlot: readonly { readonly slot: MealSlot; readonly meals: readonly Meal[]; readonly totals: Macros }[];
}

/** Итог дня: только приёмы этой даты, слоты в порядке дня, пустые слоты пропускаем */
export function daySummary(meals: readonly Meal[], date: IsoDate, targets: NutritionTargets): DaySummary {
  const today = meals.filter((m) => m.date === date);
  const totals = sumMacros(today.map((m) => m.totals));
  const bySlot = MEAL_SLOTS.map((slot) => {
    const list = today.filter((m) => m.slot === slot).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { slot, meals: list, totals: sumMacros(list.map((m) => m.totals)) };
  }).filter((g) => g.meals.length > 0);
  return {
    totals,
    kcal: progress(totals.kcal, targets.kcal),
    protein: progress(totals.protein, targets.protein),
    bySlot,
  };
}
