// apps/web/src/features/log-meal/ui/meal-form.ts — приём пищи вручную или правка записи от Claude
// Фото еды считает Claude в своём приложении (коннектор meal-mcp), сюда приходит готовая запись.
import { ChangeDetectionStrategy, Component, computed, input, type OnInit, output, signal } from '@angular/core';
import { MEAL_SLOTS, macrosLookOff, scaleItem, slotByHour, sumMacros, type IsoDate } from '@tracker/domain';
import type { Meal, MealInput, MealItem, MealSlot } from '@web/entities/meal';
import { formatKg } from '@web/shared/lib/format';
import { UiButton, parseDecimal } from '@web/shared/ui';

/** Строка состава: base — от чего масштабировать КБЖУ при смене граммов */
interface Row {
  readonly key: number;
  readonly base: MealItem;
  readonly item: MealItem;
  readonly gramsText: string;
}

type MacroKey = 'kcal' | 'protein' | 'fat' | 'carbs';

export const SLOT_LABEL: Readonly<Record<MealSlot, string>> = {
  breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекус',
};

const INPUT =
  'h-11 w-full min-w-0 rounded-xl border border-stone-300 bg-white px-2 text-[15px] tabular-nums outline-none ' +
  'focus:border-accent focus:ring-2 focus:ring-accent/30';

const fmt = (n: number) => formatKg(Math.round(n));
let seq = 0;
const row = (item: MealItem): Row => ({ key: ++seq, base: item, item, gramsText: formatKg(item.grams) });
const emptyItem = (): MealItem => ({ name: '', grams: 100, kcal: 0, protein: 0, fat: 0, carbs: 0 });

@Component({
  selector: 'app-meal-form',
  imports: [UiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-col gap-4" (submit)="$event.preventDefault(); submit()">
      <label class="flex flex-col gap-1.5">
        <span class="text-[13px] text-stone-600">Название</span>
        <input type="text" maxlength="120" [value]="title()" (input)="title.set($any($event.target).value)" class="${INPUT} px-3" />
      </label>

      <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Приём пищи">
        @for (s of slots; track s) {
          <button type="button" role="radio" [attr.aria-checked]="slot() === s" (click)="slot.set(s)"
                  class="h-10 rounded-full border border-stone-300 px-4 text-sm font-medium text-stone-700
                         aria-checked:border-accent aria-checked:bg-accent-soft aria-checked:text-accent-strong">{{ slotLabel[s] }}</button>
        }
      </div>

      <div class="flex flex-col gap-3">
        @for (r of rows(); track r.key; let i = $index) {
          <fieldset class="flex flex-col gap-2 rounded-xl border border-stone-200 p-3">
            <legend class="sr-only">Продукт {{ i + 1 }}</legend>
            <div class="flex items-center gap-2">
              <input type="text" aria-label="Название продукта" placeholder="Продукт" [value]="r.item.name"
                     (input)="setName(r.key, $any($event.target).value)" class="${INPUT} flex-1 px-3 font-medium" />
              <button type="button" class="flex size-11 shrink-0 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100"
                      [attr.aria-label]="'Убрать: ' + (r.item.name || 'продукт')" (click)="removeRow(r.key)">✕</button>
            </div>
            <div class="grid grid-cols-5 gap-1.5">
              <label class="flex flex-col gap-1">
                <span class="text-[11px] text-stone-500">Граммы</span>
                <input type="text" inputmode="decimal" [value]="r.gramsText" (input)="setGrams(r.key, $any($event.target).value)"
                       class="${INPUT} font-semibold" />
              </label>
              @for (m of macros; track m.key) {
                <label class="flex flex-col gap-1">
                  <span class="text-[11px] text-stone-500">{{ m.label }}</span>
                  <input type="text" inputmode="decimal" [value]="show(r.item[m.key])"
                         (change)="setMacro(r.key, m.key, $any($event.target).value)" class="${INPUT}" />
                </label>
              }
            </div>
          </fieldset>
        }
        <button uiButton="ghost" size="md" type="button" class="self-start" (click)="addRow()">+ Продукт</button>
        <p class="-mt-1 text-[13px] text-stone-500">Меняешь граммы — КБЖУ продукта пересчитываются пропорционально.</p>
      </div>

      <p class="rounded-xl bg-stone-100 px-3 py-2.5 text-sm tabular-nums">
        <strong>{{ fmt(totals().kcal) }} ккал</strong> ·
        Б {{ fmt(totals().protein) }} · Ж {{ fmt(totals().fat) }} · У {{ fmt(totals().carbs) }}
      </p>
      @if (looksOff()) {
        <p class="-mt-2 text-[13px] text-amber-700">Калории не сходятся с БЖУ (4/9/4 ккал на грамм) — проверь цифры.</p>
      }

      @if (error()) { <p role="alert" class="text-sm text-red-700">{{ error() }}</p> }

      <div class="flex gap-2">
        <button uiButton size="md" type="submit" class="flex-1" [disabled]="!valid() || pending()">
          {{ pending() ? 'Сохраняю…' : 'Сохранить' }}
        </button>
        <button uiButton="secondary" size="md" type="button" class="flex-1" (click)="dismiss.emit()">Отмена</button>
      </div>
      @if (initial()) {
        <button type="button" class="self-start text-sm font-medium text-red-700" (click)="remove.emit()">Удалить</button>
      }
    </form>
  `,
})
export class MealForm implements OnInit {
  readonly date = input.required<IsoDate>();
  readonly initial = input<Meal | null>(null); // null — новый приём пищи
  readonly pending = input(false);
  readonly error = input<string | null>(null);

  readonly save = output<MealInput>();
  readonly dismiss = output<void>(); // не «cancel»: так называется DOM-событие
  readonly remove = output<void>();

  protected readonly slots = MEAL_SLOTS;
  protected readonly slotLabel = SLOT_LABEL;
  protected readonly fmt = fmt;
  protected readonly macros: readonly { key: MacroKey; label: string }[] = [
    { key: 'kcal', label: 'Ккал' }, { key: 'protein', label: 'Белки' }, { key: 'fat', label: 'Жиры' }, { key: 'carbs', label: 'Углев.' },
  ];

  protected readonly slot = signal<MealSlot>(slotByHour(new Date().getHours()));
  protected readonly title = signal(SLOT_LABEL[this.slot()]);
  protected readonly rows = signal<readonly Row[]>([row(emptyItem())]);

  protected readonly totals = computed(() => sumMacros(this.rows().map((r) => r.item)));
  protected readonly looksOff = computed(() => macrosLookOff(this.totals()));
  protected readonly valid = computed(
    () => this.title().trim().length > 0 && this.rows().length > 0 && this.rows().every((r) => r.item.name.trim().length > 0),
  );

  ngOnInit(): void {
    const m = this.initial();
    if (!m) return;
    this.title.set(m.title);
    this.slot.set(m.slot);
    this.rows.set(m.items.map(row));
  }

  protected show(v: number): string {
    return formatKg(Math.round(v * 10) / 10);
  }

  protected setName(key: number, name: string): void {
    this.patch(key, (r) => ({ ...r, base: { ...r.base, name }, item: { ...r.item, name } }));
  }

  /** Граммы → КБЖУ пропорционально от base. Недописанное «15,» не трогаем */
  protected setGrams(key: number, text: string): void {
    const g = parseDecimal(text);
    this.patch(key, (r) => (g === null || g < 0 ? { ...r, gramsText: text } : { ...r, gramsText: text, item: scaleItem(r.base, g) }));
  }

  /** Ручная правка КБЖУ — новая точка отсчёта для масштаба */
  protected setMacro(key: number, macro: MacroKey, text: string): void {
    const v = parseDecimal(text);
    if (v === null || v < 0) return;
    this.patch(key, (r) => {
      const item = { ...r.item, [macro]: v };
      return { ...r, base: item, item };
    });
  }

  protected addRow(): void {
    this.rows.update((rs) => [...rs, row(emptyItem())]);
  }

  protected removeRow(key: number): void {
    this.rows.update((rs) => rs.filter((r) => r.key !== key));
  }

  protected submit(): void {
    if (!this.valid()) return;
    const it = this.initial();
    this.save.emit({
      id: it?.id ?? null,
      date: it?.date ?? this.date(),
      slot: this.slot(),
      title: this.title().trim(),
      items: this.rows().map((r) => ({ ...r.item, name: r.item.name.trim() })),
      source: it?.source ?? 'manual',
      note: it?.note ?? null,
    });
  }

  private patch(key: number, f: (r: Row) => Row): void {
    this.rows.update((rs) => rs.map((r) => (r.key === key ? f(r) : r)));
  }
}
