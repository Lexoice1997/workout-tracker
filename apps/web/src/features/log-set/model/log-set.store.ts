// apps/web/src/features/log-set/model/log-set.store.ts — ввод одного упражнения: вес + повторы по подходам
// @ngrx/signals 22, RxJS 7. Свой экземпляр на каждую карточку (providers компонента формы).
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import type { Plan, PlanSlot, SetLog, Workout } from '@tracker/domain';
import { WorkoutRepository } from '@web/entities/workout';
import { draftStorage } from '@web/shared/lib/draft-storage';
import { uuid } from '@web/shared/lib/uuid';
import { catchError, EMPTY, exhaustMap, from, pipe, tap } from 'rxjs';

interface LogSetState {
  readonly slot: PlanSlot | null;
  readonly workout: Workout | null;
  readonly logId: string;              // id лога: свой при первом сохранении, тот же при «Изменить»
  readonly weight: number | null;
  readonly reps: readonly number[];
  readonly status: 'idle' | 'saving' | 'error';
  readonly error: string | null;
}

interface Draft {
  readonly weight: number | null;
  readonly reps: readonly number[];
}

export interface LogSetInit {
  readonly slot: PlanSlot;
  readonly plan: Plan;
  readonly workout: Workout;
  readonly logged: SetLog | null; // уже записанный сегодня лог (режим «Изменить»)
}

const draftKey = (w: Workout, slotId: string) => `wt:draft:${w.date}:${slotId}`;

export const LogSetStore = signalStore(
  withState<LogSetState>({
    slot: null, workout: null, logId: '', weight: null, reps: [], status: 'idle', error: null,
  }),
  withComputed(({ slot, weight, reps }) => ({
    /** Свой вес: у слота нет шага прогрессии — поле веса не показываем, пишем 0 */
    isBodyweight: computed(() => slot()?.stepKg === null),
    canSave: computed(() => reps().length > 0 && (slot()?.stepKg === null || (weight() !== null && weight()! >= 0))),
  })),
  withMethods((store, repo = inject(WorkoutRepository)) => {
    const persistDraft = () => {
      const w = store.workout(), s = store.slot();
      if (w && s) draftStorage.write(draftKey(w, s.id), { weight: store.weight(), reps: store.reps() } satisfies Draft);
    };

    return {
      /** Приоритет начальных значений: сохранённый сегодня лог → черновик → план (повторы = верх диапазона) */
      init({ slot, plan, workout, logged }: LogSetInit): void {
        const draft = logged ? null : draftStorage.read<Draft>(draftKey(workout, slot.id));
        const sets = plan.sets;
        patchState(store, {
          slot,
          workout,
          logId: logged?.id ?? uuid(),
          weight: logged?.weightKg ?? draft?.weight ?? plan.weightKg,
          reps: logged?.reps ?? (draft?.reps.length === sets ? draft.reps : Array.from({ length: sets }, () => slot.repMax)),
          status: 'idle',
          error: null,
        });
      },
      setWeight(weight: number | null): void {
        patchState(store, { weight });
        persistDraft();
      },
      setRep(index: number, value: number): void {
        patchState(store, { reps: store.reps().map((r, i) => (i === index ? value : r)) });
        persistDraft();
      },

      /**
       * «Готово». exhaustMap: пока идёт сохранение, повторные тапы игнорируются —
       * двойной тап в зале не создаст гонку двух upsert. (switchMap отменил бы первый, mergeMap отправил бы оба.)
       *
       * Колбэк — в ОБЪЕКТЕ: голую функцию rxMethod считает реактивным вычислением (как сигнал)
       * и вызывает её сам, без аргументов.
       */
      save: rxMethod<{ readonly onSaved: (log: SetLog) => void }>(
        pipe(
          exhaustMap(({ onSaved }) => {
            const slot = store.slot(), workout = store.workout();
            if (!slot || !workout || !store.canSave()) return EMPTY;
            const log: SetLog = {
              id: store.logId(),
              workoutId: workout.id,
              slotId: slot.id,
              exerciseId: slot.exerciseId,
              repMin: slot.repMin, // снимок диапазона на момент тренировки
              repMax: slot.repMax,
              weightKg: store.isBodyweight() ? 0 : (store.weight() ?? 0),
              reps: store.reps(),
            };
            patchState(store, { status: 'saving', error: null });
            return from(repo.saveSetLog(workout, log)).pipe(
              tap((saved) => {
                draftStorage.remove(draftKey(workout, slot.id));
                patchState(store, { status: 'idle' });
                onSaved(saved);
              }),
              catchError((e: unknown) => { // внутри exhaustMap: поток живёт, можно нажать ещё раз
                patchState(store, { status: 'error', error: e instanceof Error ? e.message : String(e) });
                return EMPTY;
              }),
            );
          }),
        ),
      ),
    };
  }),
);
