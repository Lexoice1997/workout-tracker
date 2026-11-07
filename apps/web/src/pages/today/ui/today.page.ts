// apps/web/src/pages/today/ui/today.page.ts — экран «Сегодня» (вечер 3: план дня, без ввода)
import { ChangeDetectionStrategy, Component, inject, input, type OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseWorkoutRepository, WorkoutRepository } from '@web/entities/workout';
import { FinishPanel } from '@web/features/finish-workout';
import { ExerciseCard } from '@web/widgets/exercise-card';
import { formatDateLabel, weekdayShort } from '@web/shared/lib/format';
import { UiButton } from '@web/shared/ui';
import { TodayStore } from '../model/today.store';

@Component({
  selector: 'app-today-page',
  imports: [ExerciseCard, FinishPanel, RouterLink, UiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Стор и реализация репозитория живут, пока открыт экран. Здесь, а не в providers роута:
  // статический импорт в app.routes.ts затащил бы код экрана в начальный бандл.
  // Подмена Supabase → Dexie в v1.1 — одна строка здесь.
  providers: [TodayStore, { provide: WorkoutRepository, useClass: SupabaseWorkoutRepository }],
  template: `
    <div class="mx-auto flex max-w-2xl flex-col gap-4">
      @switch (store.programStatus()) {
        @case ('loading') {
          <div class="h-8 w-48 animate-pulse rounded-lg bg-stone-200" aria-label="Загрузка"></div>
        }
        @case ('empty') {
          <h1 class="text-2xl font-bold">Нет активной программы</h1>
          <p class="text-sm text-stone-600">Залей программу скриптом supabase/scripts/my-program.sql в SQL Editor.</p>
        }
        @case ('error') {
          <h1 class="text-2xl font-bold">Не удалось загрузить</h1>
          <p class="text-sm text-red-700">{{ store.error() }}</p>
          <button uiButton="secondary" size="md" type="button" class="self-start" (click)="store.retry()">Повторить</button>
        }
        @case ('ready') {
          <header class="flex flex-col gap-1">
            <p class="text-[13px] text-stone-600">
              {{ dateLabel(store.date()) }}
              @if (store.weekInCycle(); as w) { · неделя {{ w }} из {{ store.deloadEvery() }} }
              @if (store.isDeload()) { · <span class="font-semibold text-accent">разгрузка</span> }
            </p>
            <h1 class="text-2xl font-bold">{{ store.day()?.title }}</h1>
            @if (store.dayStatus() === 'ready' && store.cards().length) {
              <p class="text-[13px] text-stone-600" aria-live="polite">Записано {{ store.loggedCount() }} из {{ store.cards().length }}</p>
            }
            @if (store.isPastDate()) {
              <p class="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                Правка записи за другой день. <a routerLink="/today" class="font-semibold underline">К сегодняшней</a>
              </p>
            } @else if (store.isRestDay()) {
              <p class="text-[13px] text-stone-600">Сегодня отдых — показан ближайший день.</p>
            } @else if (!store.isToday()) {
              <p class="text-[13px] text-stone-600">Это не сегодняшняя тренировка.</p>
            }
          </header>

          <nav aria-label="День программы" class="flex gap-2">
            @for (d of store.program()?.days ?? []; track d.id) {
              <button type="button" (click)="store.selectDay(d.id)" [attr.aria-pressed]="d.id === store.dayId()"
                      class="h-11 flex-1 rounded-full border border-stone-300 bg-white text-sm font-medium text-stone-900
                             aria-pressed:border-stone-900 aria-pressed:bg-stone-900 aria-pressed:font-semibold aria-pressed:text-white">
                {{ weekday(d.weekday) }}
              </button>
            }
          </nav>

          @switch (store.dayStatus()) {
            @case ('loading') {
              @for (i of skeleton; track i) {
                <div class="h-28 animate-pulse rounded-2xl bg-stone-200"></div>
              }
            }
            @case ('error') {
              <p class="text-sm text-red-700">{{ store.error() }}</p>
              <button uiButton="secondary" size="md" type="button" class="self-start" (click)="store.retry()">Повторить</button>
            }
            @case ('ready') {
              <ul class="flex flex-col gap-3">
                @for (card of store.cards(); track card.slot.id) {
                  <li>
                    <app-exercise-card [slot]="card.slot" [plan]="card.plan" [last]="card.last" [logged]="card.logged"
                                       [workout]="store.workout()!" [active]="card.slot.id === store.activeSlotId()"
                                       (activate)="store.activate(card.slot.id)" (saved)="store.onSaved($event)" />
                  </li>
                } @empty {
                  <li class="text-sm text-stone-600">В этом дне нет упражнений.</li>
                }
              </ul>

              @if (store.workout(); as w) {
                @if (w.finishedAt && !finishing()) {
                  <section class="flex flex-col gap-2 rounded-2xl border border-green-200 bg-green-50 p-4">
                    <h2 class="text-base font-semibold text-green-900">Тренировка завершена</h2>
                    <p class="text-sm text-green-900">
                      {{ w.cardioMin ? 'Дорожка ' + w.cardioMin + ' мин' : 'Без кардио' }}@if (w.note) { · {{ w.note }} }
                    </p>
                    <button type="button" class="self-start text-sm font-medium text-green-900 underline" (click)="finishing.set(true)">Изменить итог</button>
                  </section>
                } @else if (store.loggedCount() > 0) {
                  @if (finishing() || store.loggedCount() === store.cards().length) {
                    <app-finish-panel [workout]="w" [logged]="store.loggedCount()" [total]="store.cards().length"
                                      (finished)="store.onFinished($event); finishing.set(false)" />
                  } @else {
                    <button uiButton="secondary" type="button" (click)="finishing.set(true)">Завершить тренировку</button>
                  }
                }
              }
            }
          }
        }
      }
    </div>
  `,
})
export class TodayPage implements OnInit {
  protected readonly store = inject(TodayStore);

  /** ?date=2026-11-07&day=<id> — открыть запись за другой день (из истории). Биндинг через withComponentInputBinding */
  readonly date = input<string>();
  readonly day = input<string>();

  /** Панель завершения раскрыта вручную (или для правки итога) */
  protected readonly finishing = signal(false);

  ngOnInit(): void {
    const date = this.date();
    this.store.load({ date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined, dayId: this.day() });
  }

  protected readonly dateLabel = formatDateLabel;
  protected readonly weekday = weekdayShort;
  protected readonly skeleton = [1, 2, 3];
}
