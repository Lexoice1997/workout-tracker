// apps/web/src/pages/program/ui/program.page.ts — полный редактор: цикл, дни, упражнения, порядок
import { afterNextRender, ChangeDetectionStrategy, Component, computed, inject, Injector, input, type OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { cycleWeek } from '@tracker/domain';
import { ProgramRepository, SupabaseProgramRepository, type ProgramSlot } from '@web/entities/program';
import { CycleForm } from '@web/features/edit-cycle';
import { DayForm } from '@web/features/edit-day';
import { SlotForm } from '@web/features/edit-slot';
import { formatKg, formatScheme, weekdayShort } from '@web/shared/lib/format';
import { todayLocal } from '@web/shared/lib/local-date';
import { UiButton } from '@web/shared/ui';
import { ProgramStore } from '../model/program.store';

const LONG = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const LINK = 'h-9 shrink-0 text-sm font-medium text-stone-700 underline-offset-4 hover:underline disabled:opacity-40';
const ARROW = 'flex size-11 items-center justify-center rounded-xl border border-stone-300 bg-white text-stone-700 disabled:opacity-30';

@Component({
  selector: 'app-program-page',
  imports: [CycleForm, DayForm, RouterLink, SlotForm, UiButton],
  providers: [ProgramStore, { provide: ProgramRepository, useClass: SupabaseProgramRepository }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex max-w-2xl flex-col gap-4 lg:max-w-5xl">
      <header class="flex flex-col gap-1">
        <a routerLink="/today" class="mb-1 self-start text-[13px] font-medium text-stone-600 hover:text-stone-900">← Сегодня</a>
        <h1 class="text-2xl font-bold">Программа</h1>
        <p class="text-[13px] text-stone-600">{{ store.program()?.title }}</p>
      </header>

      @switch (store.status()) {
        @case ('loading') {
          @for (i of [1, 2, 3]; track i) { <div class="h-40 animate-pulse rounded-2xl bg-stone-200"></div> }
        }
        @case ('empty') {
          <p class="text-sm text-stone-600">Нет активной программы. Залей её скриптом supabase/scripts/my-program.sql.</p>
        }
        @case ('error') {
          <p class="text-sm text-red-700">{{ store.error() }}</p>
          <button uiButton="secondary" size="md" type="button" class="self-start" (click)="store.load()">Повторить</button>
        }
        @case ('ready') {
          @let p = store.program()!;
          <!-- цикл -->
          <section class="rounded-2xl border border-stone-200 bg-white p-4" aria-labelledby="cycle-h">
            @if (store.editing() === 'cycle') {
              <h2 id="cycle-h" class="mb-3 text-[15px] font-semibold">Цикл</h2>
              <app-cycle-form [cycleStart]="p.cycleStart" [deloadEvery]="p.deloadEvery" [pending]="store.saving()" [error]="store.formError()"
                              (save)="store.saveCycle($event)" (cancel)="store.edit(null)" />
            } @else {
              <div class="flex items-start justify-between gap-3">
                <div class="flex flex-col gap-0.5">
                  <h2 id="cycle-h" class="text-[15px] font-semibold">Цикл</h2>
                  <p class="text-[13px] text-stone-600">{{ cycleText() }}</p>
                </div>
                <button type="button" [class]="link" (click)="store.edit('cycle')">Изменить</button>
              </div>
            }
          </section>

          @if (store.formError() && !store.editing() && !store.confirm()) {
            <p role="alert" class="text-sm text-red-700">{{ store.formError() }}</p>
          }

          <div class="grid items-start gap-4 lg:grid-cols-2">
            @for (d of p.days; track d.day.id) {
              @let reorder = store.reorderDay() === d.day.id;
              <section class="flex flex-col rounded-2xl border border-stone-200 bg-white" [attr.aria-labelledby]="'day-' + d.day.id">
                <!-- шапка дня -->
                <div class="border-b border-stone-100 px-4 py-3">
                  @if (store.confirm() === 'day:' + d.day.id) {
                    <div class="flex flex-col gap-3 rounded-xl bg-red-50 p-3">
                      <p class="text-sm text-red-900">Удалить день «{{ d.day.title }}» и {{ d.slots.length }} упр.? Тренировки в истории останутся.</p>
                      @if (store.formError()) { <p role="alert" class="text-sm text-red-700">{{ store.formError() }}</p> }
                      <div class="flex gap-2">
                        <button uiButton="danger" size="md" type="button" class="flex-1" [disabled]="store.saving()" (click)="store.removeDay(d.day.id)">Да, удалить</button>
                        <button uiButton="secondary" size="md" type="button" class="flex-1" (click)="store.askConfirm(null)">Нет</button>
                      </div>
                    </div>
                  } @else if (store.editing() === 'day:' + d.day.id) {
                    <app-day-form [day]="d.day" [others]="dayList()" [pending]="store.saving()" [error]="store.formError()"
                                  (save)="store.saveDay(d.day.id, $event)" (cancel)="store.edit(null)" (remove)="store.askConfirm('day:' + d.day.id)" />
                  } @else {
                    <div class="flex items-center justify-between gap-2">
                      <h2 [id]="'day-' + d.day.id" class="min-w-0 text-[15px] font-semibold">
                        <span class="text-stone-500">{{ d.day.weekday ? weekday(d.day.weekday) + ' ·' : '' }}</span> {{ d.day.title }}
                      </h2>
                      <div class="flex shrink-0 gap-3">
                        @if (d.slots.length > 1) {
                          <button type="button" [class]="link" [attr.aria-pressed]="reorder" (click)="store.toggleReorder(d.day.id)">{{ reorder ? 'Готово' : 'Порядок' }}</button>
                        }
                        @if (!reorder) { <button type="button" [class]="link" (click)="store.edit('day:' + d.day.id)">Изменить</button> }
                      </div>
                    </div>
                  }
                </div>

                <ul class="flex flex-col divide-y divide-stone-100">
                  @for (s of d.slots; track s.id; let first = $first; let last = $last) {
                    <li [id]="'slot-' + s.id" class="px-4 py-3">
                      @if (store.confirm() === 'slot:' + s.id) {
                        <div class="flex flex-col gap-3 rounded-xl bg-red-50 p-3">
                          <p class="text-sm text-red-900">Убрать «{{ s.name }}» из дня? Записи останутся в истории.</p>
                          @if (store.formError()) { <p role="alert" class="text-sm text-red-700">{{ store.formError() }}</p> }
                          <div class="flex gap-2">
                            <button uiButton="danger" size="md" type="button" class="flex-1" [disabled]="store.saving()" (click)="store.removeSlot(d.day.id, s.id)">Да, убрать</button>
                            <button uiButton="secondary" size="md" type="button" class="flex-1" (click)="store.askConfirm(null)">Нет</button>
                          </div>
                        </div>
                      } @else if (store.editing() === s.id) {
                        <h3 class="mb-3 text-[15px] font-semibold">{{ s.name }}</h3>
                        <app-slot-form [slot]="s" [catalog]="store.catalog()" [pending]="store.saving()" [error]="store.formError()"
                                       (save)="store.saveSlot(s.id, $event)" (cancel)="store.edit(null)" (remove)="store.askConfirm('slot:' + s.id)" />
                      } @else {
                        <div class="flex items-center justify-between gap-3">
                          @if (reorder) {
                            <div class="flex shrink-0 gap-1.5">
                              <button type="button" [class]="arrow" [disabled]="first || store.saving()" [attr.aria-label]="'Выше: ' + s.name" (click)="store.move(d.day.id, s.id, -1)">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
                              </button>
                              <button type="button" [class]="arrow" [disabled]="last || store.saving()" [attr.aria-label]="'Ниже: ' + s.name" (click)="store.move(d.day.id, s.id, 1)">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                              </button>
                            </div>
                          }
                          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span class="flex flex-wrap items-center gap-x-2 text-[15px] font-medium">
                              {{ s.name }}
                              @if (s.isMain) { <span class="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">главное</span> }
                            </span>
                            <span class="text-[13px] text-stone-600 tabular-nums">{{ details(s) }}</span>
                            @if (store.savedId() === s.id) { <span class="text-[13px] font-medium text-green-700" role="status">Сохранено</span> }
                          </div>
                          @if (!reorder) {
                            <button type="button" [class]="link" [disabled]="store.saving()" (click)="store.edit(s.id)">Изменить</button>
                          }
                        </div>
                      }
                    </li>
                  } @empty {
                    <li class="px-4 py-3 text-sm text-stone-600">Упражнений пока нет.</li>
                  }
                </ul>

                @if (!reorder) {
                  <div class="border-t border-stone-100 px-4 py-3">
                    @if (store.editing() === 'new:' + d.day.id) {
                      <h3 class="mb-3 text-[15px] font-semibold">Новое упражнение</h3>
                      <app-slot-form [catalog]="store.catalog()" [pending]="store.saving()" [error]="store.formError()"
                                     (save)="store.addSlot(d.day.id, $event)" (cancel)="store.edit(null)" />
                    } @else {
                      <button type="button" class="h-9 text-sm font-semibold text-accent" (click)="store.edit('new:' + d.day.id)">+ Добавить упражнение</button>
                    }
                  </div>
                }
              </section>
            }
          </div>

          @if (store.editing() === 'day:new') {
            <section class="rounded-2xl border border-stone-200 bg-white p-4">
              <h2 class="mb-3 text-[15px] font-semibold">Новый день</h2>
              <app-day-form [others]="dayList()" [pending]="store.saving()" [error]="store.formError()"
                            (save)="store.saveDay(null, $event)" (cancel)="store.edit(null)" />
            </section>
          } @else {
            <button uiButton="secondary" type="button" (click)="store.edit('day:new')">+ Добавить день</button>
          }
        }
      }
    </div>
  `,
})
export class ProgramPage implements OnInit {
  protected readonly store = inject(ProgramStore);
  private readonly injector = inject(Injector);

  /** ?slot=<id> — открыть слот сразу (ссылка «Настроить» из карточки упражнения) */
  readonly slot = input<string>();

  protected readonly weekday = weekdayShort;
  protected readonly link = LINK;
  protected readonly arrow = ARROW;

  protected readonly dayList = computed(() => this.store.program()?.days.map((d) => d.day) ?? []);

  protected readonly cycleText = computed(() => {
    const p = this.store.program();
    if (!p?.cycleStart) return `Старт не задан · разгрузка каждую ${p?.deloadEvery ?? 6}-ю неделю`;
    const w = cycleWeek(p.cycleStart, todayLocal());
    const inCycle = w > 0 ? ((w - 1) % p.deloadEvery) + 1 : null;
    const start = LONG.format(new Date(`${p.cycleStart}T00:00:00Z`));
    return `С ${start} · разгрузка каждую ${p.deloadEvery}-ю неделю` + (inCycle ? ` · сейчас ${inCycle} из ${p.deloadEvery}` : ' · ещё не начался');
  });

  async ngOnInit(): Promise<void> {
    const slot = this.slot();
    await this.store.load(slot);
    if (!slot || this.store.editing() !== slot) return;
    afterNextRender(
      () => document.getElementById(`slot-${slot}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
      { injector: this.injector },
    );
  }

  /** «4 × 8–10 · старт 72,5 кг · шаг 2,5» */
  protected details(s: ProgramSlot): string {
    const parts = [formatScheme(s.sets, s.repMin, s.repMax)];
    if (s.startKg !== null) parts.push(`старт ${formatKg(s.startKg)} кг`);
    parts.push(s.stepKg === null ? 'прибавка повторами' : `шаг ${formatKg(s.stepKg)}`);
    return parts.join(' · ');
  }
}
