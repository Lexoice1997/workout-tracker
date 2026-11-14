// apps/web/src/pages/more/ui/more.page.ts — «Ещё»: программа, замеры, экспорт, аккаунт (на телефоне — 5-я вкладка)
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SessionStore } from '@web/entities/session';
import { WorkoutOutbox } from '@web/entities/workout';
import { ExportButtons } from '@web/features/export-data';
import { clearDataCaches } from '@web/shared/lib/clear-data-caches';
import { UiButton } from '@web/shared/ui';

@Component({
  selector: 'app-more-page',
  imports: [ExportButtons, RouterLink, UiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 class="text-2xl font-bold">Ещё</h1>

      <a routerLink="/program" class="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 hover:bg-stone-50">
        <span class="flex flex-col gap-0.5">
          <span class="text-[15px] font-semibold">Программа</span>
          <span class="text-[13px] text-stone-600">Упражнения, порядок, подходы и веса</span>
        </span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" class="text-stone-400"><path d="M9 6l6 6-6 6" /></svg>
      </a>

      <a routerLink="/body" class="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 hover:bg-stone-50">
        <span class="flex flex-col gap-0.5">
          <span class="text-[15px] font-semibold">Замеры</span>
          <span class="text-[13px] text-stone-600">Вес, живот, грудь, бицепс — раз в месяц</span>
        </span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" class="text-stone-400"><path d="M9 6l6 6-6 6" /></svg>
      </a>

      <section class="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4" aria-labelledby="more-export">
        <div class="flex flex-col gap-0.5">
          <h2 id="more-export" class="text-[15px] font-semibold">Экспорт данных</h2>
          <p class="text-[13px] text-stone-600">JSON — всё: тренировки, замеры, цели, программа. CSV — подход на строку, открывается в Google Sheets. Бэкап раз в месяц не помешает.</p>
        </div>
        <app-export-buttons />
      </section>

      <section class="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4" aria-labelledby="more-account">
        <div class="flex flex-col gap-0.5">
          <h2 id="more-account" class="text-[15px] font-semibold">Аккаунт</h2>
          <p class="truncate text-[13px] text-stone-600">{{ session.email() }}</p>
        </div>
        @if (confirmLeave()) {
          <div class="flex flex-col gap-2 rounded-xl bg-amber-50 p-3">
            <p class="text-sm text-amber-950">В очереди {{ outbox.pending() }} неотправленных записей. После выхода они пропадут.</p>
            <div class="flex gap-2">
              <button uiButton="danger" size="md" type="button" class="flex-1" (click)="signOut(true)">Выйти всё равно</button>
              <button uiButton="secondary" size="md" type="button" class="flex-1" (click)="confirmLeave.set(false)">Остаться</button>
            </div>
          </div>
        } @else {
          <button uiButton="secondary" size="md" type="button" class="self-start" [disabled]="leaving()" (click)="signOut()">
            {{ leaving() ? 'Выхожу…' : 'Выйти' }}
          </button>
        }
      </section>
    </div>
  `,
})
export class MorePage {
  protected readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  protected readonly outbox = inject(WorkoutOutbox);
  protected readonly leaving = signal(false);
  protected readonly confirmLeave = signal(false);

  protected async signOut(force = false): Promise<void> {
    if (!force && this.outbox.pending() > 0) return this.confirmLeave.set(true); // не терять подходы молча
    this.leaving.set(true);
    await clearDataCaches(); // ответы API в кэше SW — данные этого пользователя
    await this.session.signOut();
    await this.router.navigateByUrl('/login');
  }
}
