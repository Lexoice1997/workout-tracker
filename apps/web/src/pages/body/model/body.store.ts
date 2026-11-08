// apps/web/src/pages/body/model/body.store.ts — @ngrx/signals 22
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { bodySummary } from '@tracker/domain';
import { BodyMetricRepository, type BodyMetric, type BodyMetricInput } from '@web/entities/body-metric';
import { todayLocal } from '@web/shared/lib/local-date';

interface BodyState {
  readonly today: string;
  readonly items: readonly BodyMetric[]; // новые сверху
  readonly status: 'loading' | 'ready' | 'error';
  readonly error: string | null;
  readonly editing: string | null;       // id замера или 'new'
  readonly confirmDeleteId: string | null;
  readonly saving: boolean;
  readonly formError: string | null;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const byDateDesc = (a: BodyMetric, b: BodyMetric) => b.date.localeCompare(a.date);

export const BodyStore = signalStore(
  withState<BodyState>({
    today: todayLocal(), items: [], status: 'loading', error: null,
    editing: null, confirmDeleteId: null, saving: false, formError: null,
  }),
  withComputed(({ items, today, editing }) => ({
    summary: computed(() => bodySummary(items(), today())),
    takenDates: computed(() => items().map((m) => m.date)),
    /** Замеров нет — форма открыта сразу и без «Отмены» */
    isEmpty: computed(() => items().length === 0),
    isAdding: computed(() => editing() === 'new' || items().length === 0),
  })),
  withMethods((store, repo = inject(BodyMetricRepository)) => ({
    async load(): Promise<void> {
      patchState(store, { status: 'loading', error: null });
      try {
        patchState(store, { items: await repo.list(), status: 'ready' });
      } catch (e) {
        patchState(store, { status: 'error', error: message(e) });
      }
    },
    edit(id: string | null): void {
      patchState(store, { editing: id, confirmDeleteId: null, formError: null });
    },
    async save(input: BodyMetricInput): Promise<void> {
      if (store.saving()) return;
      patchState(store, { saving: true, formError: null });
      try {
        const saved = await repo.save(input);
        // upsert по (user_id, date): та же дата = та же строка → заменяем, а не дублируем
        const rest = store.items().filter((m) => m.id !== saved.id && m.date !== saved.date);
        patchState(store, { items: [...rest, saved].sort(byDateDesc), saving: false, editing: null });
      } catch (e) {
        patchState(store, { saving: false, formError: message(e) });
      }
    },
    askDelete(id: string | null): void {
      patchState(store, { confirmDeleteId: id });
    },
    async remove(id: string): Promise<void> {
      if (store.saving()) return;
      patchState(store, { saving: true, formError: null });
      try {
        await repo.remove(id);
        patchState(store, {
          items: store.items().filter((m) => m.id !== id),
          saving: false, editing: null, confirmDeleteId: null,
        });
      } catch (e) {
        patchState(store, { saving: false, formError: message(e) });
      }
    },
  })),
  withHooks({ onInit: (store) => void store.load() }),
);
