// apps/web/src/pages/progress/ui/progress.page.ts — цели и темп по e1RM
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GoalRepository, SupabaseGoalRepository } from '@web/entities/goal';
import { GoalForm } from '@web/features/edit-goal';
import { GoalChart } from '@web/widgets/goal-chart';
import type { GoalInput } from '@web/entities/goal';
import { formatKg, formatReps } from '@web/shared/lib/format';
import { UiButton } from '@web/shared/ui';
import { ProgressStore, type GoalCardVm } from '../model/progress.store';

const DEADLINE = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const DAY_MONTH = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const SHORT = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const MONTH = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const pace = (kg: number) => (kg >= 0 ? '+' : '−') + formatKg(Math.abs(Number(kg.toFixed(1))));

@Component({
  selector: 'app-progress-page',
  imports: [GoalChart, GoalForm, UiButton],
  providers: [ProgressStore, { provide: GoalRepository, useClass: SupabaseGoalRepository }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex max-w-2xl flex-col gap-4">
      <header class="flex flex-col gap-1">
        <h1 class="text-2xl font-bold">Прогресс</h1>
        <p class="text-[13px] text-stone-600">Сравнение по расчётному максимуму (e1RM), разгрузка не учитывается</p>
      </header>

      @switch (store.status()) {
        @case ('loading') {
          @for (i of [1, 2, 3]; track i) { <div class="h-36 animate-pulse rounded-2xl bg-stone-200"></div> }
        }
        @case ('error') {
          <p class="text-sm text-red-700">{{ store.error() }}</p>
          <button uiButton="secondary" size="md" type="button" class="self-start" (click)="store.load()">Повторить</button>
        }
        @case ('ready') {
          <div class="grid gap-3 lg:grid-cols-2">
            @for (card of store.cards(); track card.item.id) {
              <article class="flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-4">
                <header class="flex items-baseline justify-between gap-3">
                  <h2 class="text-[15px] font-semibold">{{ card.item.name }}</h2>
                  <span class="shrink-0 text-[13px] text-stone-600">цель {{ kg(card.item.goal.targetKg) }} × {{ card.item.goal.targetReps }}</span>
                </header>

                @if (store.editing() === card.item.id) {
                  <app-goal-form [item]="card.item" [pending]="store.saving()" [error]="store.formError()"
                                 (save)="store.save($event)" (cancel)="store.edit(null)" (remove)="store.remove(card.item.id)" />
                } @else {
                  <p class="text-[22px] font-bold">
                    @if (card.latest; as l) {
                      {{ kg(l.weightKg) }} кг <span class="text-[13px] font-medium text-stone-600">× {{ reps(l.reps) }}</span>
                    } @else {
                      <span class="text-base font-medium text-stone-600">Ещё нет записей</span>
                    }
                  </p>
                  <div class="h-2 rounded-full bg-stone-200" role="progressbar" [attr.aria-valuenow]="card.percent"
                       aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="'Прогресс к цели: ' + card.percent + '%'">
                    <div class="h-2 rounded-full" [class]="card.forecast.status === 'behind' ? 'bg-amber-500' : 'bg-accent'"
                         [style.width.%]="card.percent"></div>
                  </div>
                  <p class="text-[13px]" [class]="paceClass(card)">{{ paceText(card) }}</p>
                  @if (card.revision; as r) {
                    <section class="flex flex-col gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3" aria-label="Пересмотр цели">
                      @if (r.deadline || r.targetKg) {
                        <p class="text-sm text-amber-950">
                          При темпе {{ pace(card.forecast.actualPerWeek ?? 0) }} кг/нед к {{ deadline(card.item.goal.deadline) }} не успеть. Что поменять?
                        </p>
                        <div class="flex flex-wrap gap-2">
                          @if (r.deadline; as d) {
                            <button uiButton="secondary" size="md" type="button" class="flex-1" [disabled]="store.saving()"
                                    (click)="store.save(revised(card, { deadline: d }))">На {{ shortDate(d) }}</button>
                          }
                          @if (r.targetKg; as t) {
                            <button uiButton="secondary" size="md" type="button" class="flex-1" [disabled]="store.saving()"
                                    (click)="store.save(revised(card, { targetKg: t }))">Цель {{ kg(t) }} × {{ card.item.goal.targetReps }}</button>
                          }
                        </div>
                      } @else {
                        <p class="text-sm text-amber-950">Прогресса нет 3+ недели. Посмотри на сон и восстановление или замени упражнение в программе.</p>
                      }
                      <button type="button" class="self-start text-[13px] font-medium text-amber-900 underline-offset-4 hover:underline"
                              (click)="store.dismissRevision(card.item.id)">Оставить как есть</button>
                    </section>
                  }
                  @if (card.chart.points.length) {
                    <app-goal-chart class="mt-2" [model]="card.chart" [label]="card.item.name" />
                  }
                  <div class="flex items-center justify-between">
                    <span class="text-[13px] text-stone-500">к {{ deadline(card.item.goal.deadline) }}</span>
                    <button type="button" class="h-9 text-sm font-medium text-stone-700 underline-offset-4 hover:underline"
                            (click)="store.edit(card.item.id)">Изменить</button>
                  </div>
                }
              </article>
            } @empty {
              <p class="text-sm text-stone-600">Целей пока нет — добавь первую.</p>
            }
          </div>

          @if (store.editing() === 'new') {
            <section class="rounded-2xl border border-stone-200 bg-white p-4">
              <h2 class="mb-3 text-[15px] font-semibold">Новая цель</h2>
              <app-goal-form [exercises]="store.freeExercises()" [pending]="store.saving()" [error]="store.formError()"
                             (save)="store.save($event)" (cancel)="store.edit(null)" />
            </section>
          } @else {
            <button uiButton="secondary" type="button" (click)="store.edit('new')">Добавить цель</button>
          }
        }
      }
    </div>
  `,
})
export class ProgressPage {
  protected readonly store = inject(ProgressStore);
  protected readonly kg = formatKg;
  protected readonly reps = formatReps;

  protected readonly pace = pace;

  /** «24 мая», год — только если не текущий */
  protected shortDate(date: string): string {
    const d = new Date(`${date}T00:00:00Z`);
    return date.slice(0, 4) === this.store.today().slice(0, 4) ? DAY_MONTH.format(d) : SHORT.format(d).replace(' г.', '');
  }

  /** Цель с одной поменянной частью — для кнопок баннера */
  protected revised(card: GoalCardVm, patch: Partial<Pick<GoalInput, 'deadline' | 'targetKg'>>): GoalInput {
    const g = card.item.goal;
    return { id: card.item.id, exerciseId: g.exerciseId, targetKg: g.targetKg, targetReps: g.targetReps, deadline: g.deadline, ...patch };
  }

  protected deadline(date: string): string {
    return DEADLINE.format(new Date(`${date}T00:00:00Z`)).replace(' г.', '');
  }

  protected paceText({ forecast: f, weeksOfData, latest }: GoalCardVm): string {
    const need = `нужно ${pace(f.requiredPerWeek)} кг/нед`;
    switch (f.status) {
      case 'reached':
        return 'Цель достигнута — можно ставить следующую';
      case 'on-track':
        return `${need} · идёшь ${pace(f.actualPerWeek ?? 0)} — успеваешь`;
      case 'behind': {
        const eta = f.etaWeeks === null ? null : new Date(Date.parse(this.store.today()) + f.etaWeeks * 7 * 86_400_000);
        return `${need} · идёшь ${pace(f.actualPerWeek ?? 0)}` + (eta ? ` — при таком темпе ${MONTH.format(eta).replace(' г.', '')}` : ' — прогресса нет');
      }
      default: {
        if (!latest) return 'Запиши тренировку с этим упражнением';
        const left = Math.max(1, 3 - weeksOfData);
        return `${need} · темп покажу через ${left} ${left === 1 ? 'неделю' : 'недели'}`;
      }
    }
  }

  protected paceClass(card: GoalCardVm): string {
    switch (card.forecast.status) {
      case 'on-track':
      case 'reached':
        return 'text-green-700';
      case 'behind':
        return 'text-amber-700';
      default:
        return 'text-stone-600';
    }
  }
}
