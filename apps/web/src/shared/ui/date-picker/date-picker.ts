// apps/web/src/shared/ui/date-picker/date-picker.ts — UI-кит: свой календарь вместо <input type="date">
import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, Injector,
  input, model, signal, viewChild,
} from '@angular/core';
import { todayLocal } from '../../lib/local-date';
import {
  addDays, addMonths, clampIso, firstOfMonth, isIso, lastOfMonth, monthWeeks, shiftMonth, ymOf,
  type Iso, type YearMonth,
} from '../../lib/iso-date';

export interface DatePreset {
  readonly label: string;
  readonly value: Iso;
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;
const MONTH_TITLE = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const LABEL = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' });
const LABEL_YEAR = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const FULL = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const utc = (iso: Iso) => new Date(`${iso}T00:00:00Z`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const NAV_BTN =
  'flex size-10 items-center justify-center rounded-xl text-stone-700 hover:bg-stone-100 ' +
  'focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-30';

/**
 * <ui-date-picker inputId="bm-date" label="Дата замера" [max]="today" [(value)]="date" />
 * Клавиатура в сетке: ← → день, ↑ ↓ неделя, PageUp/PageDown месяц, Home/End начало/конец недели,
 * Enter/Space выбрать, Esc закрыть.
 */
@Component({
  selector: 'ui-date-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative inline-block',
    '(document:pointerdown)': 'onOutside($event)',
  },
  template: `
    <button #trigger type="button" [id]="inputId()" [disabled]="disabled()"
            aria-haspopup="dialog" [attr.aria-expanded]="open()" [attr.aria-label]="label() + ': ' + (value() ? full(value()) : 'не выбрана')"
            class="flex h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white pr-3 pl-3.5 text-base font-medium
                   text-stone-900 outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30
                   disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-500 aria-expanded:border-accent"
            (click)="toggle()">
      <span class="whitespace-nowrap">{{ value() ? short(value()) : placeholder() }}</span>
      <svg class="size-5 shrink-0 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    </button>

    @if (open()) {
      <div role="dialog" [attr.aria-label]="'Выбор даты: ' + label()" (keydown.escape)="close(true)"
           class="absolute top-full right-0 z-30 mt-2 flex w-[19.5rem] max-w-[calc(100vw-2rem)] flex-col gap-2
                  rounded-2xl border border-stone-200 bg-white p-3 shadow-xl shadow-stone-900/10">
        @if (chips().length) {
          <div class="flex flex-wrap gap-2 pb-1">
            @for (c of chips(); track c.value) {
              <button type="button" (click)="pick(c.value)" [attr.aria-pressed]="c.value === value()"
                      class="h-9 rounded-full border border-stone-300 px-3.5 text-sm font-medium text-stone-800 hover:bg-stone-50
                             aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent-strong">{{ c.label }}</button>
            }
          </div>
        }

        <div class="flex items-center justify-between">
          <button type="button" class="${NAV_BTN}" aria-label="Предыдущий месяц" [disabled]="!canPrev()" (click)="move(-1)">
            <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <span class="text-[15px] font-semibold" aria-live="polite">{{ title() }}</span>
          <button type="button" class="${NAV_BTN}" aria-label="Следующий месяц" [disabled]="!canNext()" (click)="move(1)">
            <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>

        <div #grid role="grid" [attr.aria-label]="title()" class="flex flex-col gap-0.5" (keydown)="onKey($event)">
          <div role="row" class="grid grid-cols-7">
            @for (w of weekdays; track w; let i = $index) {
              <span role="columnheader" class="py-1 text-center text-xs font-medium" [class]="i > 4 ? 'text-stone-400' : 'text-stone-500'">{{ w }}</span>
            }
          </div>
          @for (week of weeks(); track $index) {
            <div role="row" class="grid grid-cols-7">
              @for (d of week; track $index) {
                <div role="gridcell" class="flex justify-center" [attr.aria-selected]="d !== null && d === value()">
                  @if (d) {
                    <button type="button" [attr.data-date]="d" [tabindex]="d === focused() ? 0 : -1"
                            [disabled]="isOff(d)" [attr.aria-label]="full(d)" [attr.aria-current]="d === today ? 'date' : null"
                            (click)="pick(d)" (focus)="focused.set(d)"
                            class="flex size-10 items-center justify-center rounded-xl text-[15px] tabular-nums outline-none
                                   focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1
                                   disabled:text-stone-300"
                            [class]="dayClass(d)">{{ +d.slice(8) }}</button>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class UiDatePicker {
  readonly value = model<Iso>('');                         // [(value)]="date", '' — не выбрана
  readonly min = input<Iso | null>(null);
  readonly max = input<Iso | null>(null);
  readonly label = input.required<string>();                // для скринридера
  readonly inputId = input<string | null>(null);            // для <label for="…">
  readonly disabled = input(false);
  readonly placeholder = input('Выбрать дату');
  /** null — «Сегодня» и «Вчера»; [] — без чипов. Чипы вне min/max скрываются. */
  readonly presets = input<readonly DatePreset[] | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly grid = viewChild<ElementRef<HTMLElement>>('grid');

  protected readonly today = todayLocal();
  protected readonly weekdays = WEEKDAYS;
  protected readonly open = signal(false);
  protected readonly view = signal<YearMonth>(ymOf(this.today));
  protected readonly focused = signal<Iso>(this.today); // roving tabindex: в Tab-порядке один день

  protected readonly weeks = computed(() => monthWeeks(this.view()));
  protected readonly title = computed(() => cap(MONTH_TITLE.format(utc(firstOfMonth(this.view())))).replace(' г.', ''));
  protected readonly canPrev = computed(() => this.min() === null || lastOfMonth(shiftMonth(this.view(), -1)) >= this.min()!);
  protected readonly canNext = computed(() => this.max() === null || firstOfMonth(shiftMonth(this.view(), 1)) <= this.max()!);

  protected readonly chips = computed<readonly DatePreset[]>(() => {
    const list = this.presets() ?? [
      { label: 'Сегодня', value: this.today },
      { label: 'Вчера', value: addDays(this.today, -1) },
    ];
    return list.filter((p) => !this.isOff(p.value));
  });

  protected short(iso: Iso): string {
    // текущий год — «вс, 8 ноября», другой — «1 мая 2027»: чтобы дедлайн не путался с этим годом
    return iso.slice(0, 4) === this.today.slice(0, 4) ? LABEL.format(utc(iso)) : LABEL_YEAR.format(utc(iso)).replace(' г.', '');
  }

  protected full(iso: Iso): string {
    return FULL.format(utc(iso)).replace(' г.', '');
  }

  protected isOff(iso: Iso): boolean {
    const min = this.min();
    const max = this.max();
    return (min !== null && iso < min) || (max !== null && iso > max);
  }

  protected dayClass(d: Iso): string {
    if (d === this.value()) return 'bg-accent font-semibold text-white';
    if (d === this.today) return 'font-semibold text-accent ring-1 ring-inset ring-accent/40 hover:bg-stone-100';
    return 'text-stone-900 hover:bg-stone-100';
  }

  protected toggle(): void {
    if (this.open()) return this.close(false);
    const v = this.value();
    const start = clampIso(isIso(v) ? v : this.today, this.min(), this.max());
    this.focused.set(start);
    this.view.set(ymOf(start));
    this.open.set(true);
    this.focusDay(); // фокус сразу в сетку: можно листать стрелками
  }

  close(returnFocus: boolean): void {
    this.open.set(false);
    if (returnFocus) this.trigger().nativeElement.focus();
  }

  protected pick(iso: Iso): void {
    if (this.isOff(iso)) return;
    this.value.set(iso);
    this.close(true);
  }

  protected move(months: number): void {
    this.view.update((v) => shiftMonth(v, months));
    // фокусная дата едет вместе с месяцем, иначе Tab в сетку уведёт на невидимый день
    this.focused.set(clampIso(addMonths(this.focused(), months), this.min(), this.max()));
  }

  protected onKey(e: KeyboardEvent): void {
    const f = this.focused();
    const wd = (new Date(`${f}T00:00:00Z`).getUTCDay() + 6) % 7;
    const next: Record<string, () => Iso> = {
      ArrowLeft: () => addDays(f, -1),
      ArrowRight: () => addDays(f, 1),
      ArrowUp: () => addDays(f, -7),
      ArrowDown: () => addDays(f, 7),
      PageUp: () => addMonths(f, -1),
      PageDown: () => addMonths(f, 1),
      Home: () => addDays(f, -wd),
      End: () => addDays(f, 6 - wd),
    };
    const go = next[e.key];
    if (!go) return; // Enter/Space нажимают кнопку сами
    e.preventDefault();
    const to = clampIso(go(), this.min(), this.max());
    this.focused.set(to);
    this.view.set(ymOf(to));
    this.focusDay();
  }

  protected onOutside(e: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.close(false);
  }

  /** После перерисовки (zoneless — асинхронно) поставить фокус на focused-день */
  private focusDay(): void {
    afterNextRender(
      () => this.grid()?.nativeElement.querySelector<HTMLButtonElement>(`[data-date="${this.focused()}"]`)?.focus(),
      { injector: this.injector },
    );
  }
}
