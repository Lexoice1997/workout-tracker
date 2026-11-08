// apps/web/src/pages/progress/model/progress.store.ts — @ngrx/signals 22
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { e1rm, forecast, progressSeries, type Forecast } from '@tracker/domain';
import { GoalRepository, type ExerciseLog, type ExerciseOption, type GoalInput, type GoalItem } from '@web/entities/goal';
import { todayLocal } from '@web/shared/lib/local-date';

const HISTORY_DAYS = 16 * 7; // темп считается по 4 неделям, 16 — с запасом на пропуски

interface ProgressState {
  readonly today: string;
  readonly goals: readonly GoalItem[];
  readonly logs: readonly ExerciseLog[];
  readonly exercises: readonly ExerciseOption[];
  readonly status: 'loading' | 'ready' | 'error';
  readonly error: string | null;
  readonly editing: string | null; // id цели или 'new'
  readonly saving: boolean;
  readonly formError: string | null;
}

export interface GoalCardVm {
  readonly item: GoalItem;
  readonly forecast: Forecast;
  readonly latest: ExerciseLog | null;
  readonly weeksOfData: number;
  readonly percent: number; // текущий e1RM / целевой, 0–100
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const minusDays = (date: string, days: number): string =>
  new Date(Date.parse(date) - days * 86_400_000).toISOString().slice(0, 10);

export const ProgressStore = signalStore(
  withState<ProgressState>({
    today: todayLocal(), goals: [], logs: [], exercises: [],
    status: 'loading', error: null, editing: null, saving: false, formError: null,
  }),
  withComputed(({ today, goals, logs, exercises }) => ({
    cards: computed<readonly GoalCardVm[]>(() =>
      goals().map((item) => {
        const own = logs().filter((l) => l.exerciseId === item.goal.exerciseId);
        const { weekly, current: latest } = progressSeries(own, today());
        const current = weekly.at(-1)?.e1rm ?? 0;
        const target = e1rm(item.goal.targetKg, item.goal.targetReps);
        return {
          item,
          forecast: forecast(item.goal, weekly, today()),
          latest,
          weeksOfData: weekly.length,
          percent: Math.min(100, Math.round((current / target) * 100)),
        };
      }),
    ),
    /** Для новой цели — упражнения без активной цели (у одного упражнения одна активная цель) */
    freeExercises: computed(() => exercises().filter((e) => !goals().some((g) => g.goal.exerciseId === e.id))),
  })),
  withMethods((store, repo = inject(GoalRepository)) => {
    const loadLogs = async (goals: readonly GoalItem[]) =>
      repo.logs(goals.map((g) => g.goal.exerciseId), minusDays(store.today(), HISTORY_DAYS));

    return {
      async load(): Promise<void> {
        patchState(store, { status: 'loading', error: null });
        try {
          const [goals, exercises] = await Promise.all([repo.activeGoals(), repo.exercises()]); // независимы → параллельно
          const logs = await loadLogs(goals); // зависит от упражнений целей
          patchState(store, { goals, exercises, logs, status: 'ready' });
        } catch (e) {
          patchState(store, { status: 'error', error: message(e) });
        }
      },
      edit(id: string | null): void {
        patchState(store, { editing: id, formError: null });
      },
      async save(input: GoalInput): Promise<void> {
        if (store.saving()) return;
        patchState(store, { saving: true, formError: null });
        try {
          const saved = await repo.save(input);
          const exists = store.goals().some((g) => g.id === saved.id);
          const goals = exists ? store.goals().map((g) => (g.id === saved.id ? saved : g)) : [...store.goals(), saved];
          const logs = exists ? store.logs() : await loadLogs(goals); // новое упражнение — подтянуть его историю
          patchState(store, { goals, logs, saving: false, editing: null });
        } catch (e) {
          patchState(store, { saving: false, formError: message(e) });
        }
      },
      async remove(id: string): Promise<void> {
        if (store.saving()) return;
        patchState(store, { saving: true, formError: null });
        try {
          await repo.remove(id);
          patchState(store, { goals: store.goals().filter((g) => g.id !== id), saving: false, editing: null });
        } catch (e) {
          patchState(store, { saving: false, formError: message(e) });
        }
      },
    };
  }),
  withHooks({ onInit: (store) => void store.load() }),
);
