// apps/web/src/pages/history/model/history.store.ts — @ngrx/signals 22
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { groupByWeek } from '@tracker/domain';
import { WorkoutRepository, type HistoryEntry } from '@web/entities/workout';

interface HistoryState {
  readonly entries: readonly HistoryEntry[];
  readonly status: 'loading' | 'ready' | 'error';
  readonly error: string | null;
  readonly expandedId: string | null;
  readonly confirmDeleteId: string | null; // двухшаговое удаление вместо window.confirm
  readonly deletingId: string | null;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export const HistoryStore = signalStore(
  withState<HistoryState>({
    entries: [], status: 'loading', error: null, expandedId: null, confirmDeleteId: null, deletingId: null,
  }),
  withComputed(({ entries }) => ({
    weeks: computed(() => groupByWeek(entries(), (e) => e.workout.date)),
  })),
  withMethods((store, repo = inject(WorkoutRepository)) => ({
    async load(): Promise<void> {
      patchState(store, { status: 'loading', error: null });
      try {
        const entries = await repo.history();
        patchState(store, { entries, status: 'ready', expandedId: entries.at(0)?.workout.id ?? null }); // последняя — раскрыта
      } catch (e) {
        patchState(store, { status: 'error', error: message(e) });
      }
    },
    toggle(id: string): void {
      patchState(store, { expandedId: store.expandedId() === id ? null : id, confirmDeleteId: null });
    },
    askDelete(id: string): void {
      patchState(store, { confirmDeleteId: id });
    },
    cancelDelete(): void {
      patchState(store, { confirmDeleteId: null });
    },
    async remove(id: string): Promise<void> {
      if (store.deletingId()) return; // двойной тап
      patchState(store, { deletingId: id, error: null });
      try {
        await repo.deleteWorkout(id);
        patchState(store, {
          entries: store.entries().filter((e) => e.workout.id !== id),
          deletingId: null,
          confirmDeleteId: null,
        });
      } catch (e) {
        patchState(store, { deletingId: null, error: message(e) });
      }
    },
  })),
  withHooks({ onInit: (store) => void store.load() }),
);
