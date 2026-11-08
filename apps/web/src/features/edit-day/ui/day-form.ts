// apps/web/src/features/edit-day/ui/day-form.ts — название и день недели тренировки
import { ChangeDetectionStrategy, Component, computed, input, type OnInit, output, signal } from '@angular/core';
import type { DayPatch, ProgramDay } from '@web/entities/program';
import { UiButton } from '@web/shared/ui';

const WEEKDAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'] as const;

@Component({
  selector: 'app-day-form',
  imports: [UiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-col gap-3" (submit)="$event.preventDefault(); submit()">
      <div class="flex flex-col gap-1.5">
        <label [for]="fid('title')" class="text-sm font-medium">Название</label>
        <input [id]="fid('title')" type="text" maxlength="60" autocomplete="off" placeholder="Например, Верх A (тяжёлый)"
               class="h-11 rounded-xl border border-stone-300 bg-white px-3 text-base" [value]="title()" (input)="title.set($any($event.target).value)" />
      </div>
      <div class="flex flex-col gap-1.5">
        <label [for]="fid('wd')" class="text-sm font-medium">День недели</label>
        <select [id]="fid('wd')" class="h-11 rounded-xl border border-stone-300 bg-white px-3 text-base" (change)="setWeekday($any($event.target).value)">
          @for (w of weekdays; track w; let i = $index) { <option [value]="i + 1" [selected]="weekday() === i + 1">{{ w }}</option> }
          <option value="" [selected]="weekday() === null">Без дня — выбираю сам</option>
        </select>
        @if (clash()) { <p class="text-[13px] text-amber-700">В этот день уже есть «{{ clash() }}» — на «Сегодня» покажу первый по порядку.</p> }
      </div>
      @if (error()) { <p role="alert" class="text-sm text-red-700">{{ error() }}</p> }
      <div class="flex gap-2">
        <button uiButton size="md" type="submit" class="flex-1" [disabled]="!title().trim() || pending()">
          {{ pending() ? 'Сохраняю…' : day() ? 'Сохранить' : 'Добавить день' }}
        </button>
        <button uiButton="secondary" size="md" type="button" class="flex-1" (click)="cancel.emit()">Отмена</button>
      </div>
      @if (day()) {
        <button type="button" class="self-start text-sm font-medium text-red-700" (click)="remove.emit()">Удалить день</button>
      }
    </form>
  `,
})
export class DayForm implements OnInit {
  readonly day = input<ProgramDay | null>(null);
  readonly others = input<readonly ProgramDay[]>([]); // остальные дни — для предупреждения о совпадении
  readonly pending = input(false);
  readonly error = input<string | null>(null);

  readonly save = output<DayPatch>();
  readonly cancel = output<void>();
  readonly remove = output<void>();

  protected readonly weekdays = WEEKDAYS;
  protected readonly title = signal('');
  protected readonly weekday = signal<number | null>(null);

  protected readonly clash = computed(() => {
    const wd = this.weekday();
    return wd === null ? null : (this.others().find((d) => d.weekday === wd && d.id !== this.day()?.id)?.title ?? null);
  });

  ngOnInit(): void {
    const d = this.day();
    if (d) {
      this.title.set(d.title);
      this.weekday.set(d.weekday);
    }
  }

  protected fid(name: string): string {
    return `day-${this.day()?.id ?? 'new'}-${name}`;
  }

  protected setWeekday(v: string): void {
    this.weekday.set(v === '' ? null : Number(v));
  }

  protected submit(): void {
    const title = this.title().trim();
    if (!title) return;
    this.save.emit({ title, weekday: this.weekday() });
  }
}
