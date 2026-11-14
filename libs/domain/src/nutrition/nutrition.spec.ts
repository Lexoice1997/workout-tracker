// libs/domain/src/nutrition/nutrition.spec.ts — vitest
import { describe, expect, it } from 'vitest';
import { daySummary, macrosLookOff, scaleItem, slotByHour, sumMacros, type Meal, type MealItem } from './nutrition';

const rice: MealItem = { name: 'Рис', grams: 150, kcal: 195, protein: 4, fat: 0.5, carbs: 42 };

const meal = (p: Partial<Meal>): Meal => ({
  id: 'm', date: '2026-11-14', slot: 'lunch', title: 'Обед', items: [],
  totals: { kcal: 500, protein: 40, fat: 15, carbs: 50 }, source: 'photo', note: null,
  createdAt: '2026-11-14T08:00:00Z', ...p,
});

describe('sumMacros', () => {
  it('суммирует и округляет до 0,1', () =>
    expect(sumMacros([{ kcal: 0.1, protein: 0.2, fat: 0, carbs: 0 }, { kcal: 0.2, protein: 0.1, fat: 1, carbs: 2 }]))
      .toEqual({ kcal: 0.3, protein: 0.3, fat: 1, carbs: 2 }));
  it('пусто — нули', () => expect(sumMacros([])).toEqual({ kcal: 0, protein: 0, fat: 0, carbs: 0 }));
});

describe('scaleItem', () => {
  it('200 г вместо 150 — КБЖУ × 4/3', () =>
    expect(scaleItem(rice, 200)).toEqual({ name: 'Рис', grams: 200, kcal: 260, protein: 5.3, fat: 0.7, carbs: 56 }));
  it('0 г — всё в ноль', () => expect(scaleItem(rice, 0)).toMatchObject({ grams: 0, kcal: 0, protein: 0 }));
  it('исходник без граммов — КБЖУ не трогаем', () =>
    expect(scaleItem({ ...rice, grams: 0 }, 100)).toEqual({ ...rice, grams: 100 }));
});

describe('macrosLookOff', () => {
  it('рис сходится с 4/4/9', () => expect(macrosLookOff(rice)).toBe(false));
  it('ккал вдвое выше БЖУ — подозрительно', () =>
    expect(macrosLookOff({ kcal: 600, protein: 20, fat: 5, carbs: 30 })).toBe(true));
  it('чай без сахара не шумит', () => expect(macrosLookOff({ kcal: 2, protein: 0, fat: 0, carbs: 0.3 })).toBe(false));
});

describe('slotByHour', () => {
  it('утро, день, вечер, ночь', () => {
    expect(slotByHour(8)).toBe('breakfast');
    expect(slotByHour(13)).toBe('lunch');
    expect(slotByHour(17)).toBe('snack');
    expect(slotByHour(20)).toBe('dinner');
    expect(slotByHour(1)).toBe('snack');
  });
});

describe('daySummary', () => {
  const meals = [
    meal({ id: 'a', slot: 'dinner', createdAt: '2026-11-14T14:00:00Z' }),
    meal({ id: 'b', slot: 'breakfast', totals: { kcal: 300, protein: 25, fat: 10, carbs: 30 } }),
    meal({ id: 'c', date: '2026-11-13' }),
  ];

  it('только эта дата, слоты в порядке дня', () => {
    const s = daySummary(meals, '2026-11-14', { kcal: 2500, protein: 180 });
    expect(s.totals).toEqual({ kcal: 800, protein: 65, fat: 25, carbs: 80 });
    expect(s.bySlot.map((g) => g.slot)).toEqual(['breakfast', 'dinner']);
    expect(s.kcal).toEqual({ value: 800, target: 2500, left: 1700, ratio: 0.32 });
    expect(s.protein.left).toBe(115);
  });

  it('без цели — left и ratio null', () => {
    const s = daySummary(meals, '2026-11-14', { kcal: null, protein: null });
    expect(s.kcal.left).toBeNull();
    expect(s.protein.ratio).toBeNull();
  });

  it('перебор — отрицательный остаток', () =>
    expect(daySummary(meals, '2026-11-14', { kcal: 700, protein: null }).kcal.left).toBe(-100));
});
