// apps/web/src/features/log-set/ui/log-set-form.ts — форма ввода внутри карточки упражнения
import { ChangeDetectionStrategy, Component, inject, input, type OnInit, output } from '@angular/core';
import type { Plan, PlanSlot, SetLog, Workout } from '@tracker/domain';
import { UiButton, UiNumberInput, UiStepper } from '@web/shared/ui';
import { LogSetStore } from '../model/log-set.store';

@Component({
  selector: 'app-log-set-form',
  imports: [UiButton, UiNumberInput, UiStepper],
  providers: [LogSetStore], // свой стор на каждую карточку
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3">
      @if (!store.isBodyweight()) {
        <div class="flex items-center justify-between gap-3">
          <label [for]="'w-' + slot().id" class="text-sm text-stone-600">Вес, кг</label>
          <ui-number-input [inputId]="'w-' + slot().id" label="вес" [step]="slot().stepKg ?? 1"
                           [value]="store.weight()" (valueChange)="store.setWeight($event)" />
        </div>
      }

      @for (r of store.reps(); track $index) {
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-stone-600">Подход {{ $index + 1 }}</span>
          <ui-stepper [label]="'повторы, подход ' + ($index + 1)" [max]="50"
                      [value]="r" (valueChange)="store.setRep($index, $event)" />
        </div>
      }

      @if (store.error(); as e) {
        <p role="alert" class="text-sm text-red-700">Не сохранилось: {{ e }}</p>
      }

      <button uiButton type="button" [disabled]="!store.canSave() || store.status() === 'saving'" (click)="save()">
        {{ store.status() === 'saving' ? 'Сохраняю…' : 'Готово' }}
      </button>
    </div>
  `,
})
export class LogSetForm implements OnInit {
  protected readonly store = inject(LogSetStore);

  readonly slot = input.required<PlanSlot>();
  readonly plan = input.required<Plan>();
  readonly workout = input.required<Workout>();
  readonly logged = input<SetLog | null>(null);

  readonly saved = output<SetLog>();

  ngOnInit(): void { // signal inputs доступны с ngOnInit, в конструкторе ещё нет
    this.store.init({ slot: this.slot(), plan: this.plan(), workout: this.workout(), logged: this.logged() });
  }

  protected save(): void {
    this.store.save({ onSaved: (log) => this.saved.emit(log) });
  }
}
