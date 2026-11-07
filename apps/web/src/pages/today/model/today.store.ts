// apps/web/src/pages/today/model/today.store.ts — @ngrx/signals 22, Angular 22, RxJS 7
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  cycleWeek, isDeloadWeek, isoWeekday, nextPlan, pickDay,
  type ActiveProgram, type Plan, type PlanSlot, type SetLog, type Workout,
} from '@tracker/domain';
import { WorkoutRepository } from '@web/entities/workout';
import { todayLocal } from '@web/shared/lib/local-date';
import { uuid } from '@web/shared/lib/uuid';
import { catchError, EMPTY, from, pipe, switchMap, tap } from 'rxjs';

type Status = 'loading' | 'ready' | 'error';

interface TodayState {
  readonly date: string;
  readonly program: ActiveProgram | null;
  readonly programStatus: Status | 'empty'; // empty — активной программы нет
  readonly dayId: string | null;
  readonly slots: readonly PlanSlot[];
  readonly lastNormal: Readonly<Record<string, SetLog>>; // slotId → лог; Record, а не Map: state — простой объект
  readonly workout: Workout | null;                      // тренировка дня: из базы или новая (создастся при первом «Готово»)
  readonly todayLogs: Readonly<Record<string, SetLog>>;  // slotId → записанный сегодня лог
  readonly activeSlotId: string | null;                  // раскрытая карточка
  readonly dayStatus: Status;
  readonly error: string | null;
}

export interface ExerciseCardVm {
  readonly slot: PlanSlot;
  readonly plan: Plan;
  readonly last: SetLog | null;
  readonly logged: SetLog | null;
}

const byId = (logs: readonly SetLog[]): Record<string, SetLog> =>
  Object.fromEntries(logs.flatMap((l) => (l.slotId ? [[l.slotId, l] as const] : [])));

/** Первая незаписанная карточка — её и раскрываем */
const firstOpen = (slots: readonly PlanSlot[], logs: Readonly<Record<string, SetLog>>, after?: string): string | null => {
  const start = after ? slots.findIndex((s) => s.id === after) + 1 : 0;
  return [...slots.slice(start), ...slots.slice(0, start)].find((s) => !logs[s.id])?.id ?? null;
};

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export const TodayStore = signalStore( // без providedIn: живёт, пока открыт экран (providers роута)
  withState<TodayState>({
    date: todayLocal(),
    program: null,
    programStatus: 'loading',
    dayId: null,
    slots: [],
    lastNormal: {},
    workout: null,
    todayLogs: {},
    activeSlotId: null,
    dayStatus: 'loading',
    error: null,
  }),
  withComputed(({ date, program, dayId, slots, lastNormal, todayLogs }) => {
    const day = computed(() => program()?.days.find((d) => d.id === dayId()) ?? null);
    const todayWeekday = computed(() => isoWeekday(date()));
    const isToday = computed(() => day()?.weekday === todayWeekday());
    /** Есть ли в программе тренировка на сегодня: от этого зависит подпись «сегодня отдых» */
    const isRestDay = computed(() => !(program()?.days.some((d) => d.weekday === todayWeekday()) ?? false));
    const week = computed(() => {
      const start = program()?.cycleStart;
      return start ? cycleWeek(start, date()) : null;
    });
    const deloadEvery = computed(() => program()?.deloadEvery ?? 6);
    const isDeload = computed(() => {
      const w = week();
      return w !== null && isDeloadWeek(w, deloadEvery());
    });
    /** Неделя внутри цикла: 1…6, а не 1…∞ */
    const weekInCycle = computed(() => {
      const w = week();
      return w === null ? null : ((w - 1) % deloadEvery()) + 1;
    });
    const cards = computed<readonly ExerciseCardVm[]>(() =>
      slots().map((slot) => {
        const last = lastNormal()[slot.id] ?? null;
        return { slot, last, plan: nextPlan(slot, last, isDeload()), logged: todayLogs()[slot.id] ?? null };
      }),
    );
    const loggedCount = computed(() => slots().filter((s) => todayLogs()[s.id]).length);
    /** Открыта запись за другую дату (из истории) */
    const isPastDate = computed(() => date() !== todayLocal());
    return { day, isToday, isRestDay, isPastDate, isDeload, weekInCycle, deloadEvery, cards, loggedCount };
  }),
  withMethods((store, repo = inject(WorkoutRepository)) => {
    /**
     * Данные дня. Слоты и сегодняшняя тренировка независимы → параллельно (Promise.all).
     * Последние логи зависят от id слотов → после.
     */
    const fetchDay = async (dayId: string) => {
      const date = store.date();
      const [slots, existing] = await Promise.all([repo.slotsByDay(dayId), repo.dayWorkout(dayId, date)]);
      const lastNormal = byId(await repo.lastNormalLogs(slots.map((s) => s.id)));
      const todayLogs = byId(existing?.logs ?? []);
      const workout: Workout = existing?.workout ?? {
        id: uuid(), // в базу попадёт при первом «Готово»
        dayId,
        dayTitle: store.program()?.days.find((d) => d.id === dayId)?.title ?? '',
        date,
        isDeload: store.isDeload(),
        cardioMin: null,
        note: null,
        finishedAt: null,
      };
      return { slots, lastNormal, workout, todayLogs, activeSlotId: firstOpen(slots, todayLogs) };
    };

    const selectDay = rxMethod<string>(
      pipe(
        tap((dayId) => patchState(store, { dayId, dayStatus: 'loading', error: null })), // tap — сайд-эффект: показать лоадер
        switchMap((dayId) => // switchMap: быстрый тап по другому дню — ответ предыдущего запроса отбрасывается
          from(fetchDay(dayId)).pipe(
            tap((data) => patchState(store, { ...data, dayStatus: 'ready' })),
            catchError((e: unknown) => { // ловим ВНУТРИ switchMap, иначе одна ошибка убьёт весь поток
              patchState(store, { dayStatus: 'error', error: message(e) });
              return EMPTY;
            }),
          ),
        ),
      ),
    );

    /**
     * @param opts.date — дата записи (по умолчанию сегодня): из истории можно открыть прошлую тренировку
     * @param opts.dayId — конкретный день программы; иначе выбираем автоматически
     */
    async function load(opts: { date?: string; dayId?: string } = {}): Promise<void> {
      patchState(store, { programStatus: 'loading', error: null, date: opts.date ?? todayLocal() });
      try {
        const program = await repo.activeProgram();
        const requested = program?.days.find((d) => d.id === opts.dayId);
        const pick = requested ? { day: requested, isToday: false } : program ? pickDay(program.days, store.date()) : null;
        if (!program || !pick) {
          patchState(store, { program, programStatus: 'empty' });
          return;
        }
        patchState(store, { program, programStatus: 'ready' });
        selectDay(pick.day.id);
      } catch (e) {
        patchState(store, { programStatus: 'error', error: message(e) });
      }
    }

    function retry(): void {
      const dayId = store.dayId();
      if (store.programStatus() === 'ready' && dayId) selectDay(dayId);
      else void load();
    }

    /** Тап по заголовку карточки: раскрыть, повторный тап — свернуть */
    function activate(slotId: string): void {
      patchState(store, { activeSlotId: store.activeSlotId() === slotId ? null : slotId });
    }

    /** Подход сохранён: отметить и раскрыть следующее незаписанное упражнение */
    function onSaved(log: SetLog): void {
      if (!log.slotId) return;
      const todayLogs = { ...store.todayLogs(), [log.slotId]: log };
      patchState(store, { todayLogs, activeSlotId: firstOpen(store.slots(), todayLogs, log.slotId) });
    }

    /** Тренировка завершена: обновить итог в сторе */
    function onFinished(workout: Workout): void {
      patchState(store, { workout });
    }

    return { load, selectDay, retry, activate, onSaved, onFinished };
  }),
);
