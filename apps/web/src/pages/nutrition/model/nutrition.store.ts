// apps/web/src/pages/nutrition/model/nutrition.store.ts — @ngrx/signals 22
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { daySummary, type IsoDate } from '@tracker/domain';
import { MealRepository, type Meal, type MealInput, type NutritionTargets } from '@web/entities/meal';
import { addDays } from '@web/shared/lib/iso-date';
import { todayLocal } from '@web/shared/lib/local-date';

interface NutritionState {
  readonly today: IsoDate;
  readonly date: IsoDate;
  readonly meals: readonly Meal[];
  readonly targets: NutritionTargets;
  readonly status: 'loading' | 'ready' | 'error';
  readonly error: string | null;
  readonly editing: string | null; // id приёма пищи или 'new'
  readonly editingTargets: boolean;
  readonly confirmDeleteId: string | null;
  readonly saving: boolean;
  readonly formError: string | null;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export const NutritionStore = signalStore(
  withState<NutritionState>({
    today: todayLocal(), date: todayLocal(), meals: [], targets: { kcal: null, protein: null },
    status: 'loading', error: null, editing: null, editingTargets: false, confirmDeleteId: null,
    saving: false, formError: null,
  }),
  withComputed(({ meals, date, today, targets }) => ({
    summary: computed(() => daySummary(meals(), date(), targets())),
    isToday: computed(() => date() === today()),
    hasTargets: computed(() => targets().kcal !== null || targets().protein !== null),
  })),
  withMethods((store, repo = inject(MealRepository)) => {
    let requestId = 0; // быстрые тапы по стрелкам: применяем только последний ответ

    async function loadDay(date: IsoDate): Promise<void> {
      const id = ++requestId;
      patchState(store, { date, status: 'loading', error: null, editing: null, confirmDeleteId: null });
      try {
        const meals = await repo.byDate(date);
        if (id === requestId) patchState(store, { meals, status: 'ready' });
      } catch (e) {
        if (id === requestId) patchState(store, { status: 'error', error: message(e) });
      }
    }

    return {
      async init(): Promise<void> {
        const [targets] = await Promise.all([repo.targets().catch(() => store.targets()), loadDay(store.date())]);
        patchState(store, { targets });
      },
      reload: () => loadDay(store.date()),
      shiftDay(days: number): void {
        const next = addDays(store.date(), days);
        if (next <= store.today()) void loadDay(next);
      },
      edit(id: string | null): void {
        patchState(store, { editing: id, confirmDeleteId: null, formError: null, editingTargets: false });
      },
      editTargets(open: boolean): void {
        patchState(store, { editingTargets: open, editing: null, formError: null });
      },
      async save(input: MealInput): Promise<void> {
        if (store.saving()) return;
        patchState(store, { saving: true, formError: null });
        try {
          const saved = await repo.save(input);
          const rest = store.meals().filter((m) => m.id !== saved.id);
          patchState(store, { meals: [...rest, saved], saving: false, editing: null });
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
            meals: store.meals().filter((m) => m.id !== id), saving: false, editing: null, confirmDeleteId: null,
          });
        } catch (e) {
          patchState(store, { saving: false, formError: message(e) });
        }
      },
      async saveTargets(t: NutritionTargets): Promise<void> {
        if (store.saving()) return;
        patchState(store, { saving: true, formError: null });
        try {
          patchState(store, { targets: await repo.saveTargets(t), saving: false, editingTargets: false });
        } catch (e) {
          patchState(store, { saving: false, formError: message(e) });
        }
      },
    };
  }),
  withHooks({ onInit: (store) => void store.init() }),
);
