// apps/web/src/pages/program/model/program.store.ts — @ngrx/signals 22: полный редактор программы
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import {
  ProgramRepository,
  type CatalogExercise, type CyclePatch, type DayPatch, type ProgramDayWithSlots, type ProgramSlot, type ProgramTree, type SlotPatch,
} from '@web/entities/program';

interface ProgramState {
  readonly program: ProgramTree | null;
  readonly catalog: readonly CatalogExercise[];
  readonly status: 'loading' | 'ready' | 'empty' | 'error';
  readonly error: string | null;
  /** Что раскрыто: id слота | 'new:<dayId>' | 'day:<dayId>' | 'day:new' | 'cycle' */
  readonly editing: string | null;
  readonly confirm: string | null;     // ключ удаления, ждущего подтверждения: 'slot:<id>' | 'day:<id>'
  readonly reorderDay: string | null;  // день в режиме «порядок»
  readonly savedId: string | null;
  readonly saving: boolean;
  readonly formError: string | null;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const nextSort = (items: readonly { readonly sort: number }[]) => Math.max(0, ...items.map((i) => i.sort)) + 1;

export const ProgramStore = signalStore(
  withState<ProgramState>({
    program: null, catalog: [], status: 'loading', error: null,
    editing: null, confirm: null, reorderDay: null, savedId: null, saving: false, formError: null,
  }),
  withMethods((store, repo = inject(ProgramRepository)) => {
    /** Обновить дни программы иммутабельно */
    const setDays = (fn: (days: readonly ProgramDayWithSlots[]) => readonly ProgramDayWithSlots[]) => {
      const p = store.program();
      if (p) patchState(store, { program: { ...p, days: fn(p.days) } });
    };
    const mapSlots = (dayId: string, fn: (slots: readonly ProgramSlot[]) => readonly ProgramSlot[]) =>
      setDays((days) => days.map((d) => (d.day.id === dayId ? { ...d, slots: fn(d.slots) } : d)));

    /** Общая обвязка записи: флаг, ошибка формы, закрыть форму при успехе */
    async function run(fn: () => Promise<void>, savedId: string | null = null): Promise<void> {
      if (store.saving()) return;
      patchState(store, { saving: true, formError: null });
      try {
        await fn();
        patchState(store, { saving: false, editing: null, confirm: null, savedId: savedId ?? store.savedId() });
      } catch (e) {
        patchState(store, { saving: false, formError: message(e) });
      }
    }

    /** Своё упражнение из формы → создать в каталоге и подставить id */
    async function resolveExercise(patch: SlotPatch): Promise<SlotPatch> {
      if (!patch.newExercise) return patch;
      const created = await repo.createExercise(patch.newExercise);
      patchState(store, { catalog: [...store.catalog(), created].sort((a, b) => a.name.localeCompare(b.name, 'ru')) });
      return { ...patch, exerciseId: created.id, newExercise: null };
    }

    async function load(openSlot?: string): Promise<void> {
      patchState(store, { status: 'loading', error: null });
      try {
        const [program, catalog] = await Promise.all([repo.active(), repo.catalog()]); // независимы → параллельно
        const exists = program?.days.some((d) => d.slots.some((s) => s.id === openSlot)) ?? false;
        patchState(store, { program, catalog, status: program ? 'ready' : 'empty', editing: exists ? (openSlot ?? null) : null });
      } catch (e) {
        patchState(store, { status: 'error', error: message(e) });
      }
    }

    return {
      load,
      edit(key: string | null): void {
        patchState(store, { editing: key, confirm: null, formError: null, savedId: null });
      },
      askConfirm(key: string | null): void {
        patchState(store, { confirm: key, formError: null });
      },
      toggleReorder(dayId: string): void {
        patchState(store, { reorderDay: store.reorderDay() === dayId ? null : dayId, editing: null, savedId: null });
      },

      saveSlot: (slotId: string, patch: SlotPatch) =>
        run(async () => {
          const saved = await repo.updateSlot(slotId, await resolveExercise(patch));
          mapSlots(saved.dayId, (slots) => slots.map((s) => (s.id === saved.id ? saved : s)));
        }, slotId),

      addSlot: (dayId: string, patch: SlotPatch) =>
        run(async () => {
          const day = store.program()?.days.find((d) => d.day.id === dayId);
          const added = await repo.addSlot(dayId, nextSort(day?.slots ?? []), await resolveExercise(patch));
          mapSlots(dayId, (slots) => [...slots, added]);
          patchState(store, { savedId: added.id });
        }),

      removeSlot: (dayId: string, slotId: string) =>
        run(async () => {
          await repo.removeSlot(slotId);
          mapSlots(dayId, (slots) => slots.filter((s) => s.id !== slotId));
        }),

      /** ↑/↓: меняем местами с соседом. Оптимистично; при ошибке — перечитать с сервера */
      async move(dayId: string, slotId: string, dir: -1 | 1): Promise<void> {
        const day = store.program()?.days.find((d) => d.day.id === dayId);
        if (!day || store.saving()) return;
        const list = [...day.slots];
        const i = list.findIndex((s) => s.id === slotId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j]!, list[i]!];
        const renumbered = list.map((s, k) => ({ ...s, sort: k + 1 }));
        const changed = renumbered.filter((s) => day.slots.find((o) => o.id === s.id)?.sort !== s.sort);
        mapSlots(dayId, () => renumbered);
        patchState(store, { saving: true, formError: null });
        try {
          await repo.reorder(changed.map((s) => ({ id: s.id, sort: s.sort })));
          patchState(store, { saving: false });
        } catch (e) {
          patchState(store, { saving: false, formError: message(e) });
          await load();
        }
      },

      saveDay: (dayId: string | null, patch: DayPatch) =>
        run(async () => {
          const p = store.program();
          if (!p) return;
          if (dayId) {
            const saved = await repo.updateDay(dayId, patch);
            setDays((days) => days.map((d) => (d.day.id === dayId ? { ...d, day: saved } : d)));
          } else {
            const added = await repo.addDay(p.id, nextSort(p.days.map((d) => d.day)), patch);
            setDays((days) => [...days, { day: added, slots: [] }]);
          }
        }),

      removeDay: (dayId: string) =>
        run(async () => {
          await repo.removeDay(dayId);
          setDays((days) => days.filter((d) => d.day.id !== dayId));
        }),

      saveCycle: (patch: CyclePatch) =>
        run(async () => {
          const p = store.program();
          if (!p) return;
          await repo.updateCycle(p.id, patch);
          patchState(store, { program: { ...p, cycleStart: patch.cycleStart, deloadEvery: patch.deloadEvery } });
        }),
    };
  }),
);
