// apps/web/src/widgets/exercise-card/ui/exercise-card.ts — карточка упражнения: свёрнута / ввод / записано
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { decide, nextPlan, type Plan, type PlanSlot, type SetLog, type Workout } from '@tracker/domain';
import { RouterLink } from '@angular/router';
import { LogSetForm } from '@web/features/log-set';
import { formatKg, formatReps, formatScheme } from '@web/shared/lib/format';

@Component({
  selector: 'app-exercise-card',
  imports: [LogSetForm, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="flex flex-col gap-3 rounded-2xl border bg-white p-4"
             [class]="expanded() ? 'border-accent border-2' : 'border-stone-200'">
      <button type="button" class="flex items-start justify-between gap-3 text-left" [attr.aria-expanded]="expanded()"
              (click)="activate.emit()">
        <span class="flex min-w-0 flex-col gap-0.5">
          <span class="text-base font-semibold">{{ slot().name }}</span>
          <span class="text-[13px] text-stone-600">{{ scheme() }}</span>
        </span>
        @if (logged() && !editing()) {
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Записано">
            <circle cx="12" cy="12" r="10" /><path d="M8 12.5l2.5 2.5L16 9.5" />
          </svg>
        } @else if (slot().isMain) {
          <span class="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">главное</span>
        }
      </button>

      @if (logged(); as l) {
        @if (editing()) {
          <app-log-set-form [slot]="slot()" [plan]="plan()" [workout]="workout()" [logged]="l" (saved)="onSaved($event)" />
        } @else {
          <p class="text-[15px] font-medium">{{ resultLabel() }}</p>
          <p class="rounded-xl bg-accent-soft px-3 py-2.5 text-sm">
            @switch (outcome()?.kind) {
              @case ('add') { <strong class="text-accent">Добавь вес</strong> → {{ outcome()?.next }} в следующий раз }
              @case ('add-reps') { <strong class="text-accent">Добавь повторы</strong> — вес тот же }
              @case ('deload') { <strong class="text-accent">Разгрузка</strong> — прогрессию не двигаем }
              @default { <strong class="text-accent">Держи вес</strong> — добивай верх диапазона }
            }
          </p>
          <button type="button" class="self-start text-sm font-medium text-stone-700 underline-offset-4 hover:underline"
                  (click)="editing.set(true)">Изменить</button>
        }
      } @else if (expanded()) {
        <div class="flex items-baseline justify-between gap-3">
          <p class="text-[13px] text-stone-600">
            @if (last(); as l) { Прошлый раз: {{ kg(l.weightKg) }} кг × {{ reps(l.reps) }} } @else { Первый раз в этой программе }
          </p>
          <a routerLink="/program" [queryParams]="{ slot: slot().id }"
             class="shrink-0 text-[13px] font-medium text-stone-600 underline-offset-4 hover:text-stone-900 hover:underline">Настроить</a>
        </div>
        <app-log-set-form [slot]="slot()" [plan]="plan()" [workout]="workout()" (saved)="onSaved($event)" />
      } @else {
        <p class="text-[15px]"><span class="text-stone-600">План: </span><strong class="font-semibold">{{ planLabel() }}</strong></p>
      }
    </article>
  `,
})
export class ExerciseCard {
  readonly slot = input.required<PlanSlot>();
  readonly plan = input.required<Plan>();
  readonly workout = input.required<Workout>();
  readonly last = input<SetLog | null>(null);
  readonly logged = input<SetLog | null>(null);
  readonly active = input(false);

  readonly activate = output<void>();
  readonly saved = output<SetLog>();

  protected readonly editing = signal(false);
  protected readonly kg = formatKg;
  protected readonly reps = formatReps;

  protected readonly expanded = computed(() => this.editing() || (this.active() && !this.logged()));

  protected readonly scheme = computed(() => {
    const s = this.slot();
    return formatScheme(this.plan().sets, s.repMin, s.repMax); // на разгрузке подходов меньше — из плана
  });

  protected readonly planLabel = computed(() => {
    const { weightKg } = this.plan();
    if (weightKg !== null) return `${formatKg(weightKg)} кг`;
    return this.slot().stepKg === null ? 'свой вес' : 'подбери рабочий вес';
  });

  protected readonly resultLabel = computed(() => {
    const l = this.logged();
    if (!l) return '';
    return this.slot().stepKg === null ? `Повторы: ${formatReps(l.reps)}` : `${formatKg(l.weightKg)} кг × ${formatReps(l.reps)}`;
  });

  /** Что делать в следующий раз — та же логика, что считает план (libs/domain) */
  protected readonly outcome = computed(() => {
    const l = this.logged();
    if (!l) return null;
    if (this.workout().isDeload) return { kind: 'deload' as const, next: '' };
    const next = nextPlan(this.slot(), l, false).weightKg;
    return { kind: decide(this.slot(), l), next: next === null ? '' : `${formatKg(next)} кг` };
  });

  protected onSaved(log: SetLog): void {
    this.editing.set(false);
    this.saved.emit(log);
  }
}
