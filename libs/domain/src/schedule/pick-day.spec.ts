// libs/domain/src/schedule/pick-day.spec.ts — Vitest
import { describe, expect, it } from 'vitest';
import { isoWeekday, pickDay } from './pick-day';
import type { ProgramDay } from '../models';

const day = (code: string, weekday: number | null, sort: number): ProgramDay => ({ id: code, code, title: code, weekday, sort });
const program = [day('tue', 2, 1), day('thu', 4, 2), day('sat', 6, 3)];

describe('isoWeekday', () => {
  it('7 ноября 2026 — суббота', () => expect(isoWeekday('2026-11-07')).toBe(6));
  it('8 ноября 2026 — воскресенье = 7', () => expect(isoWeekday('2026-11-08')).toBe(7));
});

describe('pickDay', () => {
  it('день тренировки — он и сегодня', () =>
    expect(pickDay(program, '2026-11-07')).toEqual({ day: program[2], isToday: true }));
  it('воскресенье — ближайший вторник', () =>
    expect(pickDay(program, '2026-11-08')).toEqual({ day: program[0], isToday: false }));
  it('среда — четверг', () =>
    expect(pickDay(program, '2026-11-11')?.day.code).toBe('thu'));
  it('нет привязки к дням — первый по sort', () =>
    expect(pickDay([day('a', null, 1), day('b', null, 2)], '2026-11-07')?.day.code).toBe('a'));
  it('пустая программа — null', () => expect(pickDay([], '2026-11-07')).toBeNull());
});
