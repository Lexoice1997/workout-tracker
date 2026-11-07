// apps/web/src/shared/ui/stepper/stepper.ts — UI-кит: − значение +
import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

const BTN =
  'flex size-11 items-center justify-center rounded-xl border border-stone-300 bg-white text-xl font-semibold ' +
  'text-stone-900 active:bg-stone-100 disabled:opacity-40';

@Component({
  selector: 'ui-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2">
      <button type="button" class="${BTN}" [attr.aria-label]="'Меньше: ' + label()"
              [disabled]="value() <= min()" (click)="change(-step())">−</button>
      <output class="w-12 text-center text-lg font-semibold tabular-nums" aria-live="polite">{{ value() }}</output>
      <button type="button" class="${BTN}" [attr.aria-label]="'Больше: ' + label()"
              [disabled]="value() >= max()" (click)="change(step())">+</button>
    </div>
  `,
})
export class UiStepper {
  readonly value = model.required<number>(); // [(value)]="reps"
  readonly min = input(0);
  readonly max = input(99);
  readonly step = input(1);
  /** Для скринридера: «повторы, подход 2» */
  readonly label = input.required<string>();

  protected change(delta: number): void {
    this.value.update((v) => Math.min(this.max(), Math.max(this.min(), Number((v + delta).toFixed(2)))));
  }
}
