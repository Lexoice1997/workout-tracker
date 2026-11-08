// apps/web/src/pages/body/ui/body.page.ts — замеры: последний, динамика, форма, история
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { BodyField, FieldChange, GapTrend } from '@tracker/domain';
import { BodyMetricRepository, SupabaseBodyMetricRepository, type BodyMetric } from '@web/entities/body-metric';
import { BodyMetricForm } from '@web/features/log-body-metric';
import { formatKg } from '@web/shared/lib/format';
import { UiButton } from '@web/shared/ui';
import { BodyStore } from '../model/body.store';

const DAY_MONTH = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const FULL = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const utc = (d: string) => new Date(`${d}T00:00:00Z`);

const UNIT: Record<BodyField, string> = { weightKg: 'кг', waistCm: 'см', chestCm: 'см', bicepsRCm: 'см', bicepsLCm: 'см' };
const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + formatKg(Math.abs(n));
const v = (n: number | null) => (n === null ? '—' : formatKg(n));

@Component({
  selector: 'app-body-page',
  imports: [BodyMetricForm, UiButton],
  providers: [BodyStore, { provide: BodyMetricRepository, useClass: SupabaseBodyMetricRepository }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = store.summary();
    <div class="mx-auto flex max-w-2xl flex-col gap-4 lg:max-w-5xl">
      <header class="flex flex-col gap-1">
        <h1 class="text-2xl font-bold">Замеры</h1>
        @if (s.nextDue) {
          @if (s.overdue) {
            <p class="text-[13px] font-medium text-amber-700">Пора замериться — прошлый был {{ dayMonth(s.latest!.date) }}</p>
          } @else {
            <p class="text-[13px] text-stone-600">Раз в месяц, утром натощак · следующий {{ dayMonth(s.nextDue) }}</p>
          }
        } @else {
          <p class="text-[13px] text-stone-600">Раз в месяц, утром натощак</p>
        }
      </header>

      @switch (store.status()) {
        @case ('loading') {
          <div class="h-48 animate-pulse rounded-2xl bg-stone-200"></div>
          <div class="h-32 animate-pulse rounded-2xl bg-stone-200"></div>
        }
        @case ('error') {
          <p class="text-sm text-red-700">{{ store.error() }}</p>
          <button uiButton="secondary" size="md" type="button" class="self-start" (click)="store.load()">Повторить</button>
        }
        @case ('ready') {
          <div class="grid items-start gap-4 lg:grid-cols-2">
            <div class="flex flex-col gap-4">
              @if (s.latest; as latest) {
                <section class="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4" aria-labelledby="bm-last">
                  <div class="flex items-baseline justify-between">
                    <h2 id="bm-last" class="text-[15px] font-semibold">Последний замер</h2>
                    <span class="text-[13px] text-stone-600">{{ full(latest.date) }}</span>
                  </div>
                  <dl class="grid grid-cols-2 gap-3">
                    @for (f of s.fields; track f.field) {
                      <div class="flex flex-col gap-0.5" [class.col-span-2]="f.field === 'weightKg'">
                        <dt class="text-[13px] text-stone-600">{{ label[f.field] }}</dt>
                        <dd class="flex items-baseline gap-2">
                          <span class="text-xl font-bold tabular-nums">{{ f.value === null ? '—' : kg(f.value) + ' ' + unit[f.field] }}</span>
                          @if (f.delta !== null) {
                            <span class="text-[13px] font-medium tabular-nums" [class]="deltaClass(f)">{{ signed(f.delta) }}</span>
                          }
                        </dd>
                      </div>
                    }
                  </dl>
                  @if (s.gap; as gap) {
                    <p class="rounded-xl bg-accent-soft px-3 py-2.5 text-sm">
                      <strong class="text-accent-strong">Грудь − живот: {{ signed(gap.now) }} см.</strong>
                      {{ gapText(gap) }}
                    </p>
                  }
                </section>
              }

              @if (store.isAdding()) {
                <section class="rounded-2xl border border-stone-200 bg-white p-4" aria-labelledby="bm-new">
                  <h2 id="bm-new" class="mb-3 text-[15px] font-semibold">{{ store.isEmpty() ? 'Первый замер' : 'Новый замер' }}</h2>
                  <app-body-metric-form [previous]="s.latest" [takenDates]="store.takenDates()" [cancelable]="!store.isEmpty()"
                                        [pending]="store.saving()" [error]="store.formError()"
                                        (save)="store.save($event)" (cancel)="store.edit(null)" />
                </section>
              } @else {
                <button uiButton type="button" (click)="store.edit('new')">Новый замер</button>
              }
            </div>

            @if (!store.isEmpty()) {
              <section class="flex flex-col gap-2" aria-labelledby="bm-all">
                <h2 id="bm-all" class="text-[15px] font-semibold">Все замеры</h2>
                @for (m of store.items(); track m.id) {
                  <article class="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4">
                    @if (store.confirmDeleteId() === m.id) {
                      <div class="flex flex-col gap-3 rounded-xl bg-red-50 p-3">
                        <p class="text-sm text-red-900">Удалить замер за {{ full(m.date) }}? Это не отменить.</p>
                        <div class="flex gap-2">
                          <button uiButton="danger" size="md" type="button" class="flex-1" [disabled]="store.saving()"
                                  (click)="store.remove(m.id)">{{ store.saving() ? 'Удаляю…' : 'Да, удалить' }}</button>
                          <button uiButton="secondary" size="md" type="button" class="flex-1" (click)="store.askDelete(null)">Нет</button>
                        </div>
                      </div>
                    } @else if (store.editing() === m.id) {
                      <h3 class="text-[15px] font-semibold">{{ full(m.date) }}</h3>
                      <app-body-metric-form [initial]="m" [pending]="store.saving()" [error]="store.formError()"
                                            (save)="store.save($event)" (cancel)="store.edit(null)" (remove)="store.askDelete(m.id)" />
                    } @else {
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex min-w-0 flex-col gap-1">
                          <span class="text-[15px] font-semibold">{{ full(m.date) }}</span>
                          <span class="text-[13px] text-stone-600 tabular-nums">{{ line(m) }}</span>
                        </div>
                        <button type="button" class="h-9 shrink-0 text-sm font-medium text-stone-700 underline-offset-4 hover:underline"
                                (click)="store.edit(m.id)">Изменить</button>
                      </div>
                    }
                  </article>
                }
              </section>
            }
          </div>
        }
      }
    </div>
  `,
})
export class BodyPage {
  protected readonly store = inject(BodyStore);
  protected readonly kg = formatKg;
  protected readonly signed = signed;
  protected readonly unit = UNIT;
  protected readonly label: Record<BodyField, string> = {
    weightKg: 'Вес', waistCm: 'Живот', chestCm: 'Грудь', bicepsRCm: 'Бицепс П', bicepsLCm: 'Бицепс Л',
  };

  protected dayMonth(d: string): string {
    return DAY_MONTH.format(utc(d));
  }

  protected full(d: string): string {
    return FULL.format(utc(d)).replace(' г.', '');
  }

  protected deltaClass(f: FieldChange): string {
    switch (f.verdict) {
      case 'better': return 'text-green-700';
      case 'worse': return 'text-red-700';
      default: return 'text-stone-500';
    }
  }

  protected gapText(g: GapTrend): string {
    if (g.delta === null || g.since === null) return 'Первая точка — сравню со следующим замером.';
    const since = `с ${this.dayMonth(g.since)}`;
    if (g.delta > 0) return `Разрыв вырос на ${formatKg(g.delta)} см ${since} — идёт рекомпозиция.`;
    if (g.delta < 0) return `Разрыв сократился на ${formatKg(-g.delta)} см ${since}.`;
    return `Без изменений ${since}.`;
  }

  /** «95 кг · живот 104 · грудь 108 · бицепс 42 / 41» — пустые поля пропускаем */
  protected line(m: BodyMetric): string {
    const parts = [
      m.weightKg === null ? null : `${formatKg(m.weightKg)} кг`,
      m.waistCm === null ? null : `живот ${formatKg(m.waistCm)}`,
      m.chestCm === null ? null : `грудь ${formatKg(m.chestCm)}`,
      m.bicepsRCm === null && m.bicepsLCm === null ? null : `бицепс ${v(m.bicepsRCm)} / ${v(m.bicepsLCm)}`,
    ];
    return parts.filter((p) => p !== null).join(' · ');
  }
}
