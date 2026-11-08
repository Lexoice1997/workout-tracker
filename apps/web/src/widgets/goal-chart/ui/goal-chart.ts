// apps/web/src/widgets/goal-chart/ui/goal-chart.ts — e1RM по неделям, цель, нужная траектория, разгрузки. Чистый SVG.
import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, signal,
} from '@angular/core';
import type { GoalChartModel } from '@tracker/domain';
import { formatKg } from '@web/shared/lib/format';

const H = 148;
const PAD = { l: 34, r: 10, t: 14, b: 22 } as const;
const WEEK_MS = 7 * 86_400_000;
const MONTH = new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: 'UTC' });
const DAY = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const kg = (v: number) => formatKg(Math.round(v));

@Component({
  selector: 'app-goal-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block' },
  template: `
    @let m = model();
    <svg [attr.width]="width()" [attr.height]="h" class="block overflow-visible" role="img" [attr.aria-label]="summary()">
      <!-- разгрузки: фон, под всем -->
      @for (d of m.deloads; track d) {
        <rect [attr.x]="x(d)" [attr.y]="pad.t" [attr.width]="weekW()" [attr.height]="h - pad.t - pad.b" class="fill-stone-100" />
      }
      <!-- сетка и подписи Y: тихие -->
      @for (t of m.yTicks; track t) {
        <line [attr.x1]="pad.l" [attr.x2]="width() - pad.r" [attr.y1]="y(t)" [attr.y2]="y(t)" class="stroke-stone-200" stroke-width="1" />
        <text [attr.x]="pad.l - 6" [attr.y]="y(t)" text-anchor="end" dominant-baseline="middle" class="fill-stone-500 text-[11px] tabular-nums">{{ kgLabel(t) }}</text>
      }
      @for (mo of monthTicks(); track mo.iso) {
        <text [attr.x]="mo.x" [attr.y]="h - 6" text-anchor="middle" class="fill-stone-500 text-[11px]">{{ mo.label }}</text>
      }
      <!-- цель -->
      <line [attr.x1]="pad.l" [attr.x2]="width() - pad.r" [attr.y1]="y(m.target)" [attr.y2]="y(m.target)"
            class="stroke-stone-500" stroke-width="1" stroke-dasharray="2 3" />
      <!-- подпись слева: справа в цель упирается линия нужного темпа -->
      <text [attr.x]="pad.l + 4" [attr.y]="y(m.target) - 5" class="fill-stone-600 text-[11px] font-medium tabular-nums">цель {{ kgLabel(m.target) }}</text>
      <!-- нужная траектория -->
      @if (m.path; as p) {
        <line [attr.x1]="x(p.from.week)" [attr.y1]="y(p.from.e1rm)" [attr.x2]="x(p.to.week)" [attr.y2]="y(p.to.e1rm)"
              class="stroke-stone-400" stroke-width="1.5" stroke-dasharray="5 4" stroke-linecap="round" />
      }
      <!-- факт -->
      @if (m.points.length > 1) {
        <polyline [attr.points]="line()" fill="none" class="stroke-accent" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      }
      @if (hover(); as hv) {
        <line [attr.x1]="hv.x" [attr.x2]="hv.x" [attr.y1]="pad.t" [attr.y2]="h - pad.b" class="stroke-stone-300" stroke-width="1" />
      }
      @for (p of m.points; track p.week; let i = $index) {
        <circle [attr.cx]="x(p.week)" [attr.cy]="y(p.e1rm)" [attr.r]="hover()?.i === i ? 5 : 4" class="fill-accent stroke-white" stroke-width="2" />
      }
      <!-- зона наведения: шире точек, весь плот -->
      <rect [attr.x]="pad.l" [attr.y]="0" [attr.width]="width() - pad.l - pad.r" [attr.height]="h" fill="transparent"
            (pointermove)="onMove($event)" (pointerdown)="onMove($event)" (pointerleave)="hoverIdx.set(null)" />
    </svg>

    @if (hover(); as hv) {
      <div class="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs text-white shadow"
           [style.left.px]="hv.left" role="status">
        <span class="text-stone-300">неделя с {{ hv.date }}</span> · <strong class="tabular-nums">e1RM {{ hv.value }} кг</strong>
      </div>
    }

    <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-500">
      <span class="flex items-center gap-1.5"><svg width="16" height="8" aria-hidden="true"><line x1="0" y1="4" x2="16" y2="4" class="stroke-accent" stroke-width="2" /></svg>e1RM, лучший за неделю</span>
      @if (m.path) {
        <span class="flex items-center gap-1.5"><svg width="16" height="8" aria-hidden="true"><line x1="0" y1="4" x2="16" y2="4" class="stroke-stone-400" stroke-width="1.5" stroke-dasharray="5 4" /></svg>нужный темп</span>
      }
      @if (m.deloads.length) {
        <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-3 bg-stone-100 ring-1 ring-stone-200"></span>разгрузка</span>
      }
    </div>

    <!-- таблица для скринридера: те же цифры -->
    <table class="sr-only">
      <caption>{{ label() }}: e1RM по неделям</caption>
      <tr><th scope="col">Неделя</th><th scope="col">e1RM, кг</th></tr>
      @for (p of m.points; track p.week) { <tr><td>{{ day(p.week) }}</td><td>{{ p.e1rm }}</td></tr> }
    </table>
  `,
})
export class GoalChart {
  readonly model = input.required<GoalChartModel>();
  readonly label = input.required<string>();

  protected readonly h = H;
  protected readonly pad = PAD;
  protected readonly width = signal(320);
  protected readonly hoverIdx = signal<number | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const destroyRef = inject(DestroyRef);
    // ширина = ширине карточки: на телефоне ~320, на десктопе в 2 колонки ~420
    afterNextRender(() => {
      const ro = new ResizeObserver(([e]) => e && this.width.set(Math.max(240, Math.floor(e.contentRect.width))));
      ro.observe(this.host.nativeElement);
      destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  private readonly span = computed(() => {
    const m = this.model();
    return { from: Date.parse(m.from), ms: Math.max(Date.parse(m.to) - Date.parse(m.from), WEEK_MS) };
  });

  protected x(iso: string): number {
    const { from, ms } = this.span();
    return PAD.l + ((Date.parse(iso) - from) / ms) * (this.width() - PAD.l - PAD.r);
  }

  protected y(v: number): number {
    const m = this.model();
    return PAD.t + ((m.yMax - v) / (m.yMax - m.yMin || 1)) * (H - PAD.t - PAD.b);
  }

  protected readonly weekW = computed(() => (WEEK_MS / this.span().ms) * (this.width() - PAD.l - PAD.r));

  protected readonly line = computed(() => this.model().points.map((p) => `${this.x(p.week)},${this.y(p.e1rm)}`).join(' '));

  /** Подписи месяцев; слишком близкие к краям прячем, чтобы не налезали на ось Y */
  protected readonly monthTicks = computed(() =>
    this.model()
      .months.map((iso) => ({ iso, x: this.x(iso), label: MONTH.format(utc(iso)).replace('.', '') }))
      .filter((t) => t.x > PAD.l + 12 && t.x < this.width() - PAD.r - 12),
  );

  protected readonly hover = computed(() => {
    const i = this.hoverIdx();
    const p = i === null ? undefined : this.model().points[i];
    if (!p || i === null) return null;
    const x = this.x(p.week);
    // тултип не вылезает за карточку
    const left = Math.min(Math.max(x, 90), this.width() - 90);
    return { i, x, left, date: DAY.format(utc(p.week)).replace('.', ''), value: formatKg(p.e1rm) };
  });

  protected readonly summary = computed(() => {
    const m = this.model();
    const first = m.points[0];
    const last = m.points.at(-1);
    const base = `${this.label()}: цель e1RM ${kg(m.target)} кг`;
    return first && last ? `${base}; сейчас ${kg(last.e1rm)} кг, было ${kg(first.e1rm)} кг, недель с записями: ${m.points.length}` : `${base}; записей нет`;
  });

  protected kgLabel = kg;
  protected day(iso: string): string {
    return DAY.format(utc(iso));
  }

  protected onMove(e: PointerEvent): void {
    const pts = this.model().points;
    if (!pts.length) return;
    const svg = (e.currentTarget as SVGElement).ownerSVGElement;
    const px = e.clientX - (svg?.getBoundingClientRect().left ?? 0);
    let best = 0;
    for (let i = 1; i < pts.length; i++) {
      if (Math.abs(this.x(pts[i]!.week) - px) < Math.abs(this.x(pts[best]!.week) - px)) best = i;
    }
    this.hoverIdx.set(best);
  }
}
