// apps/web/src/shared/ui/number-input/number-input.ts — UI-кит: число с запятой + кнопки ± шаг
import { ChangeDetectionStrategy, Component, effect, input, model, signal } from '@angular/core';

const BTN =
  'flex size-11 shrink-0 items-center justify-center rounded-xl border border-stone-300 bg-white text-xl font-semibold ' +
  'text-stone-900 active:bg-stone-100 disabled:opacity-40';

/** «72,5» и «72.5» → 72.5; мусор → null */
export function parseDecimal(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const format = (v: number | null): string => (v === null ? '' : String(v).replace('.', ','));

@Component({
  selector: 'ui-number-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2">
      <button type="button" class="${BTN}" [attr.aria-label]="'Меньше: ' + label()"
              [disabled]="value() === null || value()! <= min()" (click)="change(-step())">−</button>
      <input [id]="inputId()" type="text" inputmode="decimal" autocomplete="off" [placeholder]="placeholder()"
             [value]="text()" (input)="onInput($event)" (blur)="text.set(format(value()))"
             class="h-11 w-20 rounded-xl border border-stone-300 bg-white text-center text-lg font-semibold tabular-nums
                    outline-none focus:border-accent focus:ring-2 focus:ring-accent/30" />
      <button type="button" class="${BTN}" [attr.aria-label]="'Больше: ' + label()"
              (click)="change(step())">+</button>
    </div>
  `,
})
export class UiNumberInput {
  readonly value = model<number | null>(null);
  readonly step = input(1);
  readonly min = input(0);
  readonly label = input.required<string>();
  readonly inputId = input<string | null>(null); // для <label for="…">
  readonly placeholder = input('—');

  /** Текст в поле отдельно от числа: можно набирать «72,» не теряя запятую */
  protected readonly text = signal('');
  protected readonly format = format;

  constructor() {
    // внешнее изменение value (кнопки, init стора) → обновить текст, если он означает другое число
    effect(() => {
      const v = this.value();
      if (parseDecimal(this.text()) !== v) this.text.set(format(v));
    });
  }

  protected onInput(e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    this.text.set(raw);
    const n = parseDecimal(raw);
    if (n === null && raw.trim() !== '') return; // недописанное «7,» — не трогаем value
    this.value.set(n === null ? null : Math.max(this.min(), n));
  }

  protected change(delta: number): void {
    const next = Number(((this.value() ?? 0) + delta).toFixed(2));
    this.value.set(Math.max(this.min(), next));
  }
}
