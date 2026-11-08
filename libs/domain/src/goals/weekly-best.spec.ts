// libs/domain/src/goals/weekly-best.spec.ts — Vitest
import { describe, expect, it } from 'vitest';
import { bestE1rm, bestOfLatestWeek, latestLog, progressSeries, weeklyBests } from './weekly-best';

describe('bestE1rm', () => {
  it('берёт подход с максимумом повторов', () =>
    expect(bestE1rm({ date: '2026-11-07', weightKg: 85, reps: [6, 6, 5, 4] })).toBeCloseTo(102, 1)); // 85 × (1 + 6/30)
  it('нулевые повторы не считаются', () =>
    expect(bestE1rm({ date: '2026-11-07', weightKg: 85, reps: [0, 0] })).toBe(0));
});

describe('weeklyBests', () => {
  it('лучший за неделю среди дней (жим Вт объём и Сб тяжёлый)', () => {
    const r = weeklyBests([
      { date: '2026-11-03', weightKg: 72.5, reps: [10, 10, 9, 8] }, // Вт: e1RM 96.7
      { date: '2026-11-07', weightKg: 85, reps: [6, 6, 6, 6] },     // Сб: e1RM 102 — лучший
      { date: '2026-10-31', weightKg: 85, reps: [6, 6, 5, 5] },     // прошлая неделя
    ]);
    expect(r).toEqual([
      { week: '2026-10-26', e1rm: 102 },
      { week: '2026-11-02', e1rm: 102 },
    ]);
  });
  it('свой вес пропускается', () =>
    expect(weeklyBests([{ date: '2026-11-05', weightKg: 0, reps: [15, 15] }])).toEqual([]));
});

describe('latestLog', () => {
  it('самый свежий по дате', () =>
    expect(latestLog([{ date: '2026-10-31', weightKg: 85, reps: [6] }, { date: '2026-11-07', weightKg: 87.5, reps: [5] }])?.weightKg).toBe(87.5));
  it('пусто — null', () => expect(latestLog([])).toBeNull());
});

describe('bestOfLatestWeek', () => {
  it('тяжёлая суббота, а не объёмный вторник после неё', () => {
    const r = bestOfLatestWeek([
      { date: '2026-11-07', weightKg: 85, reps: [6, 6, 6, 6] },   // Сб, неделя 2–8
      { date: '2026-11-10', weightKg: 72.5, reps: [10, 10, 9, 9] }, // Вт, неделя 9–15: e1RM 96.7
      { date: '2026-11-14', weightKg: 87.5, reps: [6, 6, 5, 5] },  // Сб, неделя 9–15: e1RM 105 — лучший
    ]);
    expect(r?.weightKg).toBe(87.5);
  });
  it('в последней неделе только объём — он и есть', () =>
    expect(bestOfLatestWeek([{ date: '2026-11-07', weightKg: 85, reps: [6] }, { date: '2026-11-10', weightKg: 72.5, reps: [10] }])?.weightKg).toBe(72.5));
  it('пусто — null', () => expect(bestOfLatestWeek([])).toBeNull());
});

describe('progressSeries', () => {
  const logs = [
    { date: '2026-10-31', weightKg: 85, reps: [6, 6, 6, 6] },    // e1RM 102
    { date: '2026-11-07', weightKg: 87.5, reps: [6, 6, 6, 6] },  // e1RM 105
    { date: '2026-11-10', weightKg: 72.5, reps: [10, 10, 10, 9] }, // Вт текущей недели: 96.7
  ];
  it('вторник: незаконченная и худшая неделя не учитывается', () => {
    const r = progressSeries(logs, '2026-11-10');
    expect(r.weekly.map((w) => w.week)).toEqual(['2026-10-26', '2026-11-02']);
    expect(r.current?.weightKg).toBe(87.5);
  });
  it('суббота с рекордом: текущая неделя учитывается сразу', () => {
    const r = progressSeries([...logs, { date: '2026-11-14', weightKg: 90, reps: [6, 6, 6, 6] }], '2026-11-14');
    expect(r.weekly.at(-1)).toEqual({ week: '2026-11-09', e1rm: 108 });
    expect(r.current?.weightKg).toBe(90);
  });
  it('прошедшая слабая неделя остаётся: это реальный сигнал', () =>
    expect(progressSeries(logs, '2026-11-17').weekly).toHaveLength(3));
});
