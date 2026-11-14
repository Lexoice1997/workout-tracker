// apps/web/src/pages/nutrition/ui/nutrition.page.ts — питание за день: итог против цели, приёмы пищи
// Фото еды считает Claude в своём приложении (коннектор meal-mcp), здесь — дневник, итоги и правка.
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { Meal, Progress } from '@tracker/domain';
import { MealRepository, SupabaseMealRepository } from '@web/entities/meal';
import { MealForm, SLOT_LABEL } from '@web/features/log-meal';
import { formatDateLabel, formatKg } from '@web/shared/lib/format';
import { UiButton, parseDecimal } from '@web/shared/ui';
import { NutritionStore } from '../model/nutrition.store';

const round = (n: number) => formatKg(Math.round(n));

@Component({
  selector: 'app-nutrition-page',
  imports: [MealForm, UiButton],
  providers: [
    NutritionStore,
    { provide: MealRepository, useClass: SupabaseMealRepository },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = store.summary();
    <div class="mx-auto flex max-w-2xl flex-col gap-4 lg:max-w-5xl">
      <header class="flex items-center justify-between gap-2">
        <h1 class="text-2xl font-bold">Питание</h1>
        <div class="flex items-center gap-1">
          <button type="button" class="flex size-11 items-center justify-center rounded-xl text-stone-700 hover:bg-stone-200/60"
                  aria-label="Предыдущий день" (click)="store.shiftDay(-1)">‹</button>
          <span class="min-w-28 text-center text-[15px] font-medium">{{ store.isToday() ? 'Сегодня' : dateLabel(store.date()) }}</span>
          <button type="button" class="flex size-11 items-center justify-center rounded-xl text-stone-700 hover:bg-stone-200/60
                                       disabled:opacity-30" aria-label="Следующий день" [disabled]="store.isToday()"
                  (click)="store.shiftDay(1)">›</button>
        </div>
      </header>

      <!-- grid-cols-1 = minmax(0,1fr): иначе длинная строка состава (nowrap) распирает колонку шире экрана -->
      <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div class="flex flex-col gap-4">
          <!-- Итог дня -->
          <section class="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4" aria-labelledby="nu-day">
            <div class="flex items-baseline justify-between">
              <h2 id="nu-day" class="text-[15px] font-semibold">За день</h2>
              <button type="button" class="h-9 text-sm font-medium text-stone-700 underline-offset-4 hover:underline"
                      (click)="openTargets()">{{ store.hasTargets() ? 'Цели' : 'Задать цели' }}</button>
            </div>
            @if (store.editingTargets()) {
              <form class="flex flex-col gap-3" (submit)="$event.preventDefault(); saveTargets()">
                <div class="grid grid-cols-2 gap-3">
                  <label class="flex flex-col gap-1.5">
                    <span class="text-[13px] text-stone-600">Ккал в день</span>
                    <input type="text" inputmode="numeric" placeholder="2500" [value]="kcalText()" (input)="kcalText.set($any($event.target).value)"
                           class="h-12 rounded-xl border border-stone-300 px-3 text-base tabular-nums outline-none focus:border-accent focus:ring-2 focus:ring-accent/30" />
                  </label>
                  <label class="flex flex-col gap-1.5">
                    <span class="text-[13px] text-stone-600">Белок, г</span>
                    <input type="text" inputmode="numeric" placeholder="180" [value]="proteinText()" (input)="proteinText.set($any($event.target).value)"
                           class="h-12 rounded-xl border border-stone-300 px-3 text-base tabular-nums outline-none focus:border-accent focus:ring-2 focus:ring-accent/30" />
                  </label>
                </div>
                <p class="-mt-1 text-[13px] text-stone-500">Белок на рекомпозиции — 1,6–2,2 г на кг веса. Пусто — без цели.</p>
                @if (targetsInvalid()) { <p role="alert" class="text-sm text-red-700">Ккал 800–8000, белок 20–500 г.</p> }
                @if (store.formError()) { <p role="alert" class="text-sm text-red-700">{{ store.formError() }}</p> }
                <div class="flex gap-2">
                  <button uiButton size="md" type="submit" class="flex-1" [disabled]="store.saving()">Сохранить</button>
                  <button uiButton="secondary" size="md" type="button" class="flex-1" (click)="store.editTargets(false)">Отмена</button>
                </div>
              </form>
            } @else {
              @for (p of [{ label: 'Калории', unit: 'ккал', v: s.kcal }, { label: 'Белок', unit: 'г', v: s.protein }]; track p.label) {
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-baseline justify-between text-sm">
                    <span class="text-stone-600">{{ p.label }}</span>
                    <span class="tabular-nums"><strong class="text-base">{{ r(p.v.value) }}</strong>
                      @if (p.v.target !== null) { / {{ r(p.v.target) }} } {{ p.unit }}</span>
                  </div>
                  @if (p.v.ratio !== null) {
                    <div class="h-2 overflow-hidden rounded-full bg-stone-200" role="progressbar" [attr.aria-label]="p.label"
                         [attr.aria-valuenow]="p.v.value" aria-valuemin="0" [attr.aria-valuemax]="p.v.target">
                      <div class="h-full rounded-full" [class]="barClass(p.v)" [style.width.%]="Math.min(100, p.v.ratio * 100)"></div>
                    </div>
                    <span class="text-[13px] text-stone-600 tabular-nums">{{ leftText(p.v, p.unit) }}</span>
                  }
                </div>
              }
              <p class="text-[13px] text-stone-600 tabular-nums">Жиры {{ r(s.totals.fat) }} г · углеводы {{ r(s.totals.carbs) }} г</p>
            }
          </section>

          <!-- Новый приём пищи -->
          @if (store.editing() === 'new') {
            <section class="rounded-2xl border border-stone-200 bg-white p-4" aria-labelledby="nu-new">
              <h2 id="nu-new" class="mb-3 text-[15px] font-semibold">Новый приём пищи</h2>
              <app-meal-form [date]="store.date()" [pending]="store.saving()" [error]="store.formError()"
                             (save)="store.save($event)" (dismiss)="store.edit(null)" />
            </section>
          } @else {
            <div class="flex flex-col gap-2">
              <button uiButton type="button" (click)="store.edit('new')">+ Добавить вручную</button>
              <p class="text-[13px] text-stone-600">Фото еды — в приложение Claude с подписью «запиши»: коннектор «Дневник питания» посчитает КБЖУ и добавит запись сюда.</p>
            </div>
          }
        </div>

        <!-- Приёмы пищи -->
        <section class="flex flex-col gap-2" aria-labelledby="nu-list">
          <h2 id="nu-list" class="text-[15px] font-semibold">Приёмы пищи</h2>
          @switch (store.status()) {
            @case ('loading') {
              <div class="h-24 animate-pulse rounded-2xl bg-stone-200"></div>
            }
            @case ('error') {
              <p class="text-sm text-red-700">{{ store.error() }}</p>
              <button uiButton="secondary" size="md" type="button" class="self-start" (click)="store.reload()">Повторить</button>
            }
            @case ('ready') {
              @for (g of s.bySlot; track g.slot) {
                <div class="flex items-baseline justify-between px-1 pt-2 text-[13px] text-stone-600">
                  <span class="font-semibold uppercase tracking-wide">{{ slotLabel[g.slot] }}</span>
                  <span class="tabular-nums">{{ r(g.totals.kcal) }} ккал</span>
                </div>
                @for (m of g.meals; track m.id) {
                  <article class="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4">
                    @if (store.confirmDeleteId() === m.id) {
                      <div class="flex flex-col gap-3 rounded-xl bg-red-50 p-3">
                        <p class="text-sm text-red-900">Удалить «{{ m.title }}»? Это не отменить.</p>
                        <div class="flex gap-2">
                          <button uiButton="danger" size="md" type="button" class="flex-1" [disabled]="store.saving()"
                                  (click)="store.remove(m.id)">{{ store.saving() ? 'Удаляю…' : 'Да, удалить' }}</button>
                          <button uiButton="secondary" size="md" type="button" class="flex-1" (click)="store.askDelete(null)">Нет</button>
                        </div>
                      </div>
                    } @else if (store.editing() === m.id) {
                      <app-meal-form [date]="store.date()" [initial]="m" [pending]="store.saving()" [error]="store.formError()"
                                     (save)="store.save($event)" (dismiss)="store.edit(null)" (remove)="store.askDelete(m.id)" />
                    } @else {
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex min-w-0 flex-col gap-1">
                          <span class="text-[15px] font-semibold">{{ m.title }}</span>
                          <span class="text-[13px] text-stone-600 tabular-nums">{{ line(m) }}</span>
                          <span class="truncate text-[13px] text-stone-500">{{ items(m) }}</span>
                        </div>
                        <button type="button" class="h-9 shrink-0 text-sm font-medium text-stone-700 underline-offset-4 hover:underline"
                                (click)="store.edit(m.id)">Изменить</button>
                      </div>
                    }
                  </article>
                }
              } @empty {
                <p class="rounded-2xl border border-dashed border-stone-300 p-4 text-sm text-stone-600">
                  {{ store.isToday() ? 'Сегодня ещё ничего. Отправь фото тарелки в Claude или добавь вручную.' : 'В этот день записей нет.' }}
                </p>
              }
            }
          }
        </section>
      </div>
    </div>
  `,
})
export class NutritionPage {
  protected readonly store = inject(NutritionStore);
  protected readonly slotLabel = SLOT_LABEL;
  protected readonly r = round;
  protected readonly Math = Math;

  protected readonly kcalText = signal('');
  protected readonly proteinText = signal('');
  protected readonly targetsInvalid = signal(false);

  protected dateLabel(d: string): string {
    return formatDateLabel(d);
  }

  protected line(m: Meal): string {
    const t = m.totals;
    return `${round(t.kcal)} ккал · Б ${round(t.protein)} · Ж ${round(t.fat)} · У ${round(t.carbs)}`;
  }

  protected items(m: Meal): string {
    return m.items.map((i) => `${i.name} ${round(i.grams)} г`).join(', ');
  }

  protected barClass(p: Progress): string {
    if (p.ratio === null) return 'bg-accent';
    if (p.ratio > 1.1) return 'bg-red-500';
    return p.ratio >= 0.9 ? 'bg-green-600' : 'bg-accent';
  }

  protected leftText(p: Progress, unit: string): string {
    if (p.left === null) return '';
    if (p.left > 0) return `Осталось ${round(p.left)} ${unit}`;
    if (p.left < 0) return `Перебор ${round(-p.left)} ${unit}`;
    return 'Ровно в цель';
  }

  protected openTargets(): void {
    const t = this.store.targets();
    this.kcalText.set(t.kcal === null ? '' : String(t.kcal));
    this.proteinText.set(t.protein === null ? '' : String(t.protein));
    this.targetsInvalid.set(false);
    this.store.editTargets(true);
  }

  protected saveTargets(): void {
    const parse = (s: string): number | null | undefined => {
      if (s.trim() === '') return null;
      const n = parseDecimal(s);
      return n === null ? undefined : Math.round(n);
    };
    const kcal = parse(this.kcalText());
    const protein = parse(this.proteinText());
    const bad =
      kcal === undefined || protein === undefined ||
      (kcal !== null && (kcal < 800 || kcal > 8000)) ||
      (protein !== null && (protein < 20 || protein > 500));
    this.targetsInvalid.set(bad);
    if (bad) return;
    void this.store.saveTargets({ kcal: kcal ?? null, protein: protein ?? null });
  }
}
