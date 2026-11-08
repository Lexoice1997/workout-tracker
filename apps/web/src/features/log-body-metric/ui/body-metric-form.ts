// apps/web/src/features/log-body-metric/ui/body-metric-form.ts — новый замер / правка замера
import { ChangeDetectionStrategy, Component, computed, input, type OnInit, output, signal } from '@angular/core';
import type { BodyField } from '@tracker/domain';
import type { BodyMetric, BodyMetricInput } from '@web/entities/body-metric';
import { formatKg } from '@web/shared/lib/format';
import { todayLocal } from '@web/shared/lib/local-date';
import { UiButton, UiDatePicker, parseDecimal } from '@web/shared/ui';

interface FieldDef {
  readonly key: BodyField;
  readonly label: string;
  readonly min: number;
  readonly max: number; // под numeric(4,1)/(5,1) в БД и здравый смысл
}

const FIELDS: readonly FieldDef[] = [
  { key: 'weightKg', label: 'Вес, кг', min: 30, max: 300 },
  { key: 'waistCm', label: 'Живот, см', min: 40, max: 250 },
  { key: 'chestCm', label: 'Грудь, см', min: 40, max: 250 },
  { key: 'bicepsRCm', label: 'Бицепс П, см', min: 15, max: 80 },
  { key: 'bicepsLCm', label: 'Бицепс Л, см', min: 15, max: 80 },
];

type Texts = Record<BodyField, string>;
const EMPTY: Texts = { weightKg: '', waistCm: '', chestCm: '', bicepsRCm: '', bicepsLCm: '' };

const toText = (v: number | null): string => (v === null ? '' : formatKg(v));

@Component({
  selector: 'app-body-metric-form',
  imports: [UiButton, UiDatePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-col gap-4" (submit)="$event.preventDefault(); submit()">
      <div class="flex items-center justify-between gap-3">
        <label for="bm-date" class="text-sm text-stone-600">Дата</label>
        <ui-date-picker inputId="bm-date" label="Дата замера" [max]="today" [disabled]="!!initial()" [(value)]="date" />
      </div>
      @if (overwrites()) {
        <p class="-mt-2 text-[13px] text-amber-700">На эту дату замер уже есть — сохранение его перезапишет.</p>
      }

      <div class="grid grid-cols-2 gap-3">
        @for (f of fields; track f.key) {
          <div class="flex flex-col gap-1.5" [class.col-span-2]="f.key === 'weightKg'">
            <label [for]="'bm-' + f.key" class="text-[13px] text-stone-600">{{ f.label }}</label>
            <input [id]="'bm-' + f.key" type="text" inputmode="decimal" autocomplete="off"
                   [placeholder]="placeholder(f.key)" [value]="texts()[f.key]" (input)="setText(f.key, $any($event.target).value)"
                   [attr.aria-invalid]="invalid().includes(f.key)"
                   class="h-12 rounded-xl border border-stone-300 bg-white px-3 text-base font-medium tabular-nums outline-none
                          placeholder:text-stone-400 focus:border-accent focus:ring-2 focus:ring-accent/30
                          aria-[invalid=true]:border-red-500" />
          </div>
        }
      </div>
      <p class="-mt-1 text-[13px] text-stone-500">Можно заполнить не всё. Серым — прошлый замер.</p>

      @if (invalid().length) {
        <p role="alert" class="text-sm text-red-700">Проверь подсвеченные поля: число вне разумного диапазона.</p>
      }
      @if (error()) { <p role="alert" class="text-sm text-red-700">{{ error() }}</p> }

      <div class="flex gap-2">
        <button uiButton size="md" type="submit" class="flex-1" [disabled]="!valid() || pending()">
          {{ pending() ? 'Сохраняю…' : 'Сохранить замер' }}
        </button>
        @if (cancelable()) {
          <button uiButton="secondary" size="md" type="button" class="flex-1" (click)="cancel.emit()">Отмена</button>
        }
      </div>
      @if (initial()) {
        <button type="button" class="self-start text-sm font-medium text-red-700" (click)="remove.emit()">Удалить замер</button>
      }
    </form>
  `,
})
export class BodyMetricForm implements OnInit {
  readonly initial = input<BodyMetric | null>(null);   // null — новый замер
  readonly previous = input<BodyMetric | null>(null);  // для подсказок в placeholder
  readonly takenDates = input<readonly string[]>([]);  // даты, где замер уже есть
  readonly cancelable = input(true);
  readonly pending = input(false);
  readonly error = input<string | null>(null);

  readonly save = output<BodyMetricInput>();
  readonly cancel = output<void>();
  readonly remove = output<void>();

  protected readonly fields = FIELDS;
  protected readonly today = todayLocal();
  protected readonly date = signal(this.today);
  protected readonly texts = signal<Texts>(EMPTY);

  /** Разобранные значения: null — пусто, NaN — мусор */
  private readonly values = computed(() => {
    const t = this.texts();
    return Object.fromEntries(
      FIELDS.map((f) => [f.key, t[f.key].trim() === '' ? null : (parseDecimal(t[f.key]) ?? Number.NaN)]),
    ) as Record<BodyField, number | null>;
  });

  protected readonly invalid = computed<BodyField[]>(() =>
    FIELDS.filter((f) => {
      const v = this.values()[f.key];
      return v !== null && (Number.isNaN(v) || v < f.min || v > f.max);
    }).map((f) => f.key),
  );

  protected readonly valid = computed(
    () =>
      this.date() !== '' &&
      this.date() <= this.today &&
      this.invalid().length === 0 &&
      FIELDS.some((f) => this.values()[f.key] !== null), // хотя бы одно поле
  );

  protected readonly overwrites = computed(() => !this.initial() && this.takenDates().includes(this.date()));

  ngOnInit(): void {
    const it = this.initial();
    if (!it) return;
    this.date.set(it.date);
    this.texts.set(Object.fromEntries(FIELDS.map((f) => [f.key, toText(it[f.key])])) as Texts);
  }

  protected placeholder(key: BodyField): string {
    const v = this.previous()?.[key] ?? null;
    return v === null ? '—' : toText(v);
  }

  protected setText(key: BodyField, raw: string): void {
    this.texts.update((t) => ({ ...t, [key]: raw }));
  }

  protected submit(): void {
    if (!this.valid()) return;
    const v = this.values();
    const r1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10); // см в БД с точностью 0,1
    this.save.emit({
      date: this.date(),
      weightKg: v.weightKg === null ? null : Math.round(v.weightKg * 100) / 100,
      waistCm: r1(v.waistCm),
      chestCm: r1(v.chestCm),
      bicepsRCm: r1(v.bicepsRCm),
      bicepsLCm: r1(v.bicepsLCm),
    });
  }
}
