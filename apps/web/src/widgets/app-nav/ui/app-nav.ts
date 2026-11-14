// apps/web/src/widgets/app-nav/ui/app-nav.ts — нижняя навигация на телефоне, боковое меню с lg (≥1024px)
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SessionStore } from '@web/entities/session';
import { WorkoutOutbox } from '@web/entities/workout';
import { clearDataCaches } from '@web/shared/lib/clear-data-caches';

interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: string; // d для <path> иконки 24×24
  readonly mobile: boolean; // в нижней панели телефона 5 пунктов; «Программа» и «Замеры» (раз в месяц) — через «Ещё»
}

const ITEMS: readonly NavItem[] = [
  { mobile: true, path: '/today', label: 'Сегодня', icon: 'M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12' },
  { mobile: true, path: '/history', label: 'История', icon: 'M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1' },
  { mobile: true, path: '/progress', label: 'Прогресс', icon: 'M3 20h18M6 16l4-5 3 3 5-7' },
  { mobile: true, path: '/nutrition', label: 'Питание', icon: 'M7 3v8a2 2 0 0 0 4 0V3M9 13v8M17 21V3c-2 0-3.5 2.5-3.5 6s1.5 4 3.5 4' },
  { mobile: false, path: '/body', label: 'Замеры', icon: 'M3 8h18v8H3zM7 8v3M11 8v4M15 8v3M19 8v4' },
  { mobile: false, path: '/program', label: 'Программа', icon: 'M4 6h16M4 12h10M4 18h7' },
  { mobile: true, path: '/more', label: 'Ещё', icon: 'M4 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0M18 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0' },
];

@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <!-- Телефон: фиксированный низ, 5 равных кнопок. Активный пункт красим через aria-current, а не классами routerLinkActive: так базовый text-stone-* не перебивает цвет -->
    <nav aria-label="Разделы"
         class="fixed inset-x-0 bottom-0 z-10 grid h-16 grid-cols-5 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      @for (item of mobileItems; track item.path) {
        <a [routerLink]="item.path" routerLinkActive ariaCurrentWhenActive="page"
           class="flex flex-col items-center justify-center gap-0.5 text-xs text-stone-600
                  aria-[current=page]:font-semibold aria-[current=page]:text-accent">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="item.icon" /></svg>
          {{ item.label }}
        </a>
      }
    </nav>

    <!-- Десктоп: боковое меню -->
    <aside class="hidden w-60 shrink-0 flex-col gap-1 border-r border-stone-200 bg-white px-4 py-6 lg:flex">
      <p class="px-3 pb-5 text-base font-bold">Дневник</p>
      <nav aria-label="Разделы" class="flex flex-col gap-1">
        @for (item of items; track item.path) {
          <a [routerLink]="item.path" routerLinkActive ariaCurrentWhenActive="page"
             class="flex h-11 items-center rounded-lg px-3 text-[15px] text-stone-800 hover:bg-stone-100
                    aria-[current=page]:bg-accent-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent">{{ item.label }}</a>
        }
      </nav>
      <div class="mt-auto flex flex-col gap-1 px-3 pt-6">
        <p class="truncate text-xs text-stone-500">{{ session.email() }}</p>
        <button type="button" class="h-11 text-left text-[15px] text-stone-700 hover:text-stone-900" (click)="signOut()">Выйти</button>
      </div>
    </aside>
  `,
})
export class AppNav {
  protected readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  protected readonly items = ITEMS;
  protected readonly mobileItems = ITEMS.filter((i) => i.mobile);

  private readonly outbox = inject(WorkoutOutbox);

  protected async signOut(): Promise<void> {
    const n = this.outbox.pending();
    // десктоп: короткий системный confirm уместен; на телефоне выход — через «Ещё» с нормальным подтверждением
    if (n > 0 && !confirm(`В очереди ${n} неотправленных записей — после выхода они пропадут. Выйти?`)) return;
    await clearDataCaches();
    await this.session.signOut();
    await this.router.navigateByUrl('/login');
  }
}
