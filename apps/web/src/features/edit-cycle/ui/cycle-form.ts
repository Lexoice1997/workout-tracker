// apps/web/src/features/edit-cycle/ui/cycle-form.ts — старт цикла и частота разгрузки
import { ChangeDetectionStrategy, Component, input, type OnInit, output, signal } from '@angular/core';
import type { CyclePatch } from '@web/entities/program';
import { todayLocal } from '@web/shared/lib/local-date';
import { addDays } from '@web/shared/lib/iso-date';
import { UiButton, UiDatePicker, UiStepper, type DatePreset } from '@web/shared/ui';

/** Понедельник недели даты: циклы считаются неделями с понедельника */
const monday = (iso: string): string => addDays(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));

@Component({
  selector: 'app-cycle-form',
  imports: [UiButton, UiDatePicker, UiStepper],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-col gap-4" (submit)="$event.preventDefault(); submit()">
      <div class="flex items-center justify-between gap-3">
        <label for="cycle-start" class="text-sm text-stone-600">Старт цикла</label>
        <ui-date-picker inputId="cycle-start" label="Старт цикла" [presets]="presets" [(value)]="start" />
      </div>
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-stone-600">Разгрузка — каждая</span>
        <ui-stepper label="неделя разгрузки" [min]="3" [max]="12" [value]="every()" (valueChange)="every.set($event)" />
      </div>
      <p class="-mt-2 text-[13px] text-stone-500">Неделя {{ every() }} — разгрузка: вес × 0,9, половина подходов. Старт лучше ставить на понедельник.</p>
      @if (error()) { <p role="alert" class="text-sm text-red-700">{{ error() }}</p> }
      <div class="flex gap-2">
        <button uiButton size="md" type="submit" class="flex-1" [disabled]="!start() || pending()">{{ pending() ? 'Сохраняю…' : 'Сохранить' }}</button>
        <button uiButton="secondary" size="md" type="button" class="flex-1" (click)="cancel.emit()">Отмена</button>
      </div>
    </form>
  `,
})
export class CycleForm implements OnInit {
  readonly cycleStart = input<string | null>(null);
  readonly deloadEvery = input(6);
  readonly pending = input(false);
  readonly error = input<string | null>(null);

  readonly save = output<CyclePatch>();
  readonly cancel = output<void>();

  protected readonly start = signal('');
  protected readonly every = signal(6);
  /** «Новый цикл с этой недели» — после разгрузки или перерыва */
  protected readonly presets: readonly DatePreset[] = [
    { label: 'С этой недели', value: monday(todayLocal()) },
    { label: 'Со следующей', value: addDays(monday(todayLocal()), 7) },
  ];

  ngOnInit(): void {
    this.start.set(this.cycleStart() ?? monday(todayLocal()));
    this.every.set(this.deloadEvery());
  }

  protected submit(): void {
    if (!this.start()) return;
    this.save.emit({ cycleStart: this.start(), deloadEvery: this.every() });
  }
}
