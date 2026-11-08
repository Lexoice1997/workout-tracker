// apps/web/src/features/edit-goal/ui/goal-form.ts — создать / изменить / убрать цель
import { ChangeDetectionStrategy, Component, computed, input, type OnInit, output, signal } from '@angular/core';
import type { ExerciseOption, GoalInput, GoalItem } from '@web/entities/goal';
import { todayLocal } from '@web/shared/lib/local-date';
import { UiButton, UiNumberInput, UiStepper } from '@web/shared/ui';

@Component({
  selector: 'app-goal-form',
  imports: [UiButton, UiNumberInput, UiStepper],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-col gap-3" (submit)="$event.preventDefault(); submit()">
      @if (!item()) {
        <div class="flex flex-col gap-2">
          <label for="goal-exercise" class="text-sm font-medium">Упражнение</label>
          <select id="goal-exercise" class="h-12 rounded-xl border border-stone-300 bg-white px-3 text-base"
                  [value]="exerciseId()" (change)="exerciseId.set($any($event.target).value)">
            <option value="" disabled>Выбери упражнение</option>
            @for (e of exercises(); track e.id) { <option [value]="e.id">{{ e.name }}</option> }
          </select>
        </div>
      }
      <div class="flex items-center justify-between gap-3">
        <label for="goal-kg" class="text-sm text-stone-600">Вес, кг</label>
        <ui-number-input inputId="goal-kg" label="вес цели" [step]="2.5" [value]="kg()" (valueChange)="kg.set($event)" />
      </div>
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-stone-600">Повторы</span>
        <ui-stepper label="повторы цели" [min]="1" [max]="15" [value]="reps()" (valueChange)="reps.set($event)" />
      </div>
      <div class="flex items-center justify-between gap-3">
        <label for="goal-deadline" class="text-sm text-stone-600">К дате</label>
        <input id="goal-deadline" type="date" [min]="today" [value]="deadline()" (change)="deadline.set($any($event.target).value)"
               class="h-11 rounded-xl border border-stone-300 bg-white px-3 text-base" />
      </div>

      @if (error()) { <p role="alert" class="text-sm text-red-700">{{ error() }}</p> }

      <div class="flex gap-2">
        <button uiButton size="md" type="submit" class="flex-1" [disabled]="!valid() || pending()">
          {{ pending() ? 'Сохраняю…' : 'Сохранить' }}
        </button>
        <button uiButton="secondary" size="md" type="button" class="flex-1" (click)="cancel.emit()">Отмена</button>
      </div>
      @if (item()) {
        <button type="button" class="self-start text-sm font-medium text-red-700" (click)="remove.emit()">Убрать цель</button>
      }
    </form>
  `,
})
export class GoalForm implements OnInit {
  readonly item = input<GoalItem | null>(null);           // null — новая цель
  readonly exercises = input<readonly ExerciseOption[]>([]);
  readonly pending = input(false);
  readonly error = input<string | null>(null);

  readonly save = output<GoalInput>();
  readonly cancel = output<void>();
  readonly remove = output<void>();

  protected readonly today = todayLocal();
  protected readonly exerciseId = signal('');
  protected readonly kg = signal<number | null>(null);
  protected readonly reps = signal(8);
  protected readonly deadline = signal('2027-05-01');

  protected readonly valid = computed(
    () => this.exerciseId() !== '' && (this.kg() ?? 0) > 0 && this.reps() >= 1 && this.deadline() > this.today,
  );

  ngOnInit(): void {
    const it = this.item();
    if (!it) return;
    this.exerciseId.set(it.goal.exerciseId);
    this.kg.set(it.goal.targetKg);
    this.reps.set(it.goal.targetReps);
    this.deadline.set(it.goal.deadline);
  }

  protected submit(): void {
    const kg = this.kg();
    if (!this.valid() || kg === null) return;
    this.save.emit({
      id: this.item()?.id,
      exerciseId: this.exerciseId(),
      targetKg: kg,
      targetReps: this.reps(),
      deadline: this.deadline(),
    });
  }
}
