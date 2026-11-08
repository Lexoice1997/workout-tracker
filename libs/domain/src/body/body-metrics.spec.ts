// libs/domain/src/body/body-metrics.spec.ts — vitest
import { describe, expect, it } from 'vitest';
import { addMonths, bodySummary, chestWaistGap, verdict, type BodyMetric } from './body-metrics';

const m = (date: string, p: Partial<BodyMetric> = {}): BodyMetric => ({
  id: date, date, weightKg: null, waistCm: null, chestCm: null, bicepsRCm: null, bicepsLCm: null, ...p,
});

const nov = m('2026-11-01', { weightKg: 95, waistCm: 104, chestCm: 108, bicepsRCm: 42, bicepsLCm: 41 });

describe('chestWaistGap', () => {
  it('грудь − живот с округлением до 0,1', () => {
    expect(chestWaistGap(nov)).toBe(4);
    expect(chestWaistGap(m('x', { chestCm: 108.4, waistCm: 103.7 }))).toBe(4.7);
  });
  it('null, если чего-то нет', () => expect(chestWaistGap(m('x', { chestCm: 108 }))).toBeNull());
});

describe('verdict', () => {
  it('живот вниз — хорошо, грудь вниз — плохо, вес — нейтрально', () => {
    expect(verdict('waistCm', -1)).toBe('better');
    expect(verdict('chestCm', -1)).toBe('worse');
    expect(verdict('weightKg', -2)).toBe('neutral');
    expect(verdict('bicepsRCm', 0)).toBe('same');
  });
});

describe('addMonths', () => {
  it('обычный месяц', () => expect(addMonths('2026-11-01', 1)).toBe('2026-12-01'));
  it('через год', () => expect(addMonths('2026-12-15', 1)).toBe('2027-01-15'));
  it('31 января → конец февраля', () => {
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });
});

describe('bodySummary', () => {
  it('пусто', () => {
    const s = bodySummary([], '2026-11-08');
    expect(s.latest).toBeNull();
    expect(s.gap).toBeNull();
    expect(s.nextDue).toBeNull();
    expect(s.overdue).toBe(false);
  });

  it('первый замер: значения есть, дельт нет, разрыв без сравнения', () => {
    const s = bodySummary([nov], '2026-11-08');
    expect(s.fields.find((f) => f.field === 'waistCm')).toEqual({ field: 'waistCm', value: 104, delta: null, verdict: null });
    expect(s.gap).toEqual({ now: 4, delta: null, since: null });
    expect(s.nextDue).toBe('2026-12-01');
    expect(s.overdue).toBe(false);
  });

  it('дельты к прошлому и разрыв к первому; порядок входа не важен', () => {
    const dec = m('2026-12-01', { weightKg: 95, waistCm: 102.5, chestCm: 108.5, bicepsRCm: 42.5, bicepsLCm: 41 });
    const jan = m('2027-01-02', { weightKg: 94.2, waistCm: 101, chestCm: 109, bicepsRCm: 43, bicepsLCm: 41.5 });
    const s = bodySummary([jan, nov, dec], '2027-01-05');
    expect(s.latest?.date).toBe('2027-01-02');
    const by = Object.fromEntries(s.fields.map((f) => [f.field, f]));
    expect(by['waistCm']).toMatchObject({ delta: -1.5, verdict: 'better' });
    expect(by['chestCm']).toMatchObject({ delta: 0.5, verdict: 'better' });
    expect(by['weightKg']).toMatchObject({ delta: -0.8, verdict: 'neutral' });
    expect(s.gap).toEqual({ now: 8, delta: 4, since: '2026-11-01' });
  });

  it('неполный замер: дельта к последнему, где поле было', () => {
    const onlyWeight = m('2026-11-20', { weightKg: 94 });
    const dec = m('2026-12-01', { waistCm: 103 });
    const s = bodySummary([nov, onlyWeight, dec], '2026-12-02');
    const by = Object.fromEntries(s.fields.map((f) => [f.field, f]));
    expect(by['waistCm']).toMatchObject({ value: 103, delta: -1 });
    expect(by['weightKg']).toMatchObject({ value: null, delta: null }); // в последнем не мерили
    expect(s.gap).toBeNull(); // груди в последнем нет
  });

  it('просрочка — строго после даты следующего замера', () => {
    expect(bodySummary([nov], '2026-12-01').overdue).toBe(false);
    expect(bodySummary([nov], '2026-12-02').overdue).toBe(true);
  });
});
