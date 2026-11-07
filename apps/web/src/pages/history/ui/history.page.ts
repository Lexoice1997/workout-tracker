// apps/web/src/pages/history/ui/history.page.ts — тренировки по неделям, новые сверху
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseWorkoutRepository, WorkoutRepository, type HistoryEntry } from '@web/entities/workout';
import { formatDateLabel, formatKg, formatReps, formatWeekRange } from '@web/shared/lib/format';
import { UiButton } from '@web/shared/ui';
import { HistoryStore } from '../model/history.store';

@Component({
  selector: 'app-history-page',
  imports: [RouterLink, UiButton],
  providers: [HistoryStore, { provide: WorkoutRepository, useClass: SupabaseWorkoutRepository }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 class="text-2xl font-bold">История</h1>

      @switch (store.status()) {
        @case ('loading') {
          @for (i of [1, 2, 3]; track i) { <div class="h-20 animate-pulse rounded-2xl bg-stone-200"></div> }
        }
        @case ('error') {
          <p class="text-sm text-red-700">{{ store.error() }}</p>
          <button uiButton="secondary" size="md" type="button" class="self-start" (click)="store.load()">Повторить</button>
        }
        @case ('ready') {
          @if (store.error(); as e) { <p role="alert" class="text-sm text-red-700">Не удалось удалить: {{ e }}</p> }

          @for (week of store.weeks(); track week.start) {
            <section class="flex flex-col gap-2" [attr.aria-label]="'Неделя ' + range(week.start, week.end)">
              <h2 class="px-1 pt-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">{{ range(week.start, week.end) }}</h2>

              @for (entry of week.items; track entry.workout.id) {
                <article class="rounded-2xl border border-stone-200 bg-white">
                  <button type="button" class="flex w-full items-center justify-between gap-3 p-4 text-left"
                          [attr.aria-expanded]="store.expandedId() === entry.workout.id" (click)="store.toggle(entry.workout.id)">
                    <span class="flex min-w-0 flex-col gap-0.5">
                      <span class="text-base font-semibold">{{ dateLabel(entry.workout.date) }} · {{ entry.workout.dayTitle }}</span>
                      <span class="text-[13px] text-stone-600">{{ meta(entry) }}</span>
                    </span>
                    @if (entry.workout.isDeload) {
                      <span class="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700">разгрузка</span>
                    } @else if (!entry.workout.finishedAt) {
                      <span class="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">в процессе</span>
                    }
                  </button>

                  @if (store.expandedId() === entry.workout.id) {
                    <div class="flex flex-col gap-3 border-t border-stone-100 px-4 pt-3 pb-4">
                      <ul class="flex flex-col gap-2 text-sm">
                        @for (item of entry.logs; track item.log.id) {
                          <li class="flex justify-between gap-3">
                            <span class="min-w-0">{{ item.name }}</span>
                            <span class="shrink-0 font-medium tabular-nums">
                              @if (item.log.weightKg > 0) { {{ kg(item.log.weightKg) }} × } {{ reps(item.log.reps) }}
                            </span>
                          </li>
                        } @empty {
                          <li class="text-stone-600">Подходов нет</li>
                        }
                      </ul>
                      @if (entry.workout.note) { <p class="text-sm text-stone-600">«{{ entry.workout.note }}»</p> }

                      @if (store.confirmDeleteId() === entry.workout.id) {
                        <div class="flex flex-col gap-2 rounded-xl bg-red-50 p-3">
                          <p class="text-sm text-red-900">Удалить тренировку и все её подходы? Это не отменить.</p>
                          <div class="flex gap-2">
                            <button uiButton="danger" size="md" type="button" class="flex-1"
                                    [disabled]="store.deletingId() === entry.workout.id" (click)="store.remove(entry.workout.id)">
                              {{ store.deletingId() === entry.workout.id ? 'Удаляю…' : 'Да, удалить' }}
                            </button>
                            <button uiButton="secondary" size="md" type="button" class="flex-1" (click)="store.cancelDelete()">Отмена</button>
                          </div>
                        </div>
                      } @else {
                        <div class="flex gap-2">
                          @if (entry.workout.dayId) {
                            <a uiButton="secondary" size="md" class="flex-1" routerLink="/today"
                               [queryParams]="{ date: entry.workout.date, day: entry.workout.dayId }">Изменить</a>
                          }
                          <button uiButton="danger" size="md" type="button" class="flex-1" (click)="store.askDelete(entry.workout.id)">Удалить</button>
                        </div>
                      }
                    </div>
                  }
                </article>
              }
            </section>
          } @empty {
            <p class="text-sm text-stone-600">Пока пусто. Первая записанная тренировка появится здесь.</p>
          }
        }
      }
    </div>
  `,
})
export class HistoryPage {
  protected readonly store = inject(HistoryStore);
  protected readonly dateLabel = formatDateLabel;
  protected readonly range = formatWeekRange;
  protected readonly kg = formatKg;
  protected readonly reps = formatReps;

  protected meta(e: HistoryEntry): string {
    const n = e.logs.length;
    const cardio = e.workout.cardioMin ? ` · дорожка ${e.workout.cardioMin} мин` : '';
    return `${n} ${plural(n, 'упражнение', 'упражнения', 'упражнений')}${cardio}`;
  }
}

/** 1 упражнение, 2 упражнения, 5 упражнений */
function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
