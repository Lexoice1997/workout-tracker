// apps/web/src/widgets/sync-status/ui/sync-status.ts — полоска «нет сети / в очереди N / ошибка отправки»
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { WorkoutOutbox } from '@web/entities/workout';

const plural = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'запись' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'записи' : 'записей');

@Component({
  selector: 'app-sync-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @switch (state()) {
      @case ('offline') {
        <p role="status" class="mb-4 flex items-center gap-2 rounded-xl bg-stone-900 px-3 py-2 text-[13px] text-white">
          <span class="size-2 shrink-0 rounded-full bg-amber-400" aria-hidden="true"></span>
          Нет сети — подходы сохраняются на телефоне@if (outbox.pending()) { · в очереди {{ outbox.pending() }} {{ word() }} }
        </p>
      }
      @case ('syncing') {
        <p role="status" class="mb-4 rounded-xl bg-accent-soft px-3 py-2 text-[13px] text-accent-strong">Отправляю {{ outbox.pending() }} {{ word() }}…</p>
      }
      @case ('pending') {
        <p role="status" class="mb-4 rounded-xl bg-accent-soft px-3 py-2 text-[13px] text-accent-strong">В очереди {{ outbox.pending() }} {{ word() }} — отправлю автоматически</p>
      }
      @case ('error') {
        <div role="alert" class="mb-4 flex flex-col gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-900">
          <span>Не отправлено {{ outbox.pending() }} {{ word() }}: {{ outbox.lastError() }}</span>
          <button type="button" class="self-start font-semibold underline" (click)="outbox.retry()">Повторить</button>
        </div>
      }
    }
  `,
})
export class SyncStatus {
  protected readonly outbox = inject(WorkoutOutbox);
  protected readonly word = computed(() => plural(this.outbox.pending()));
  protected readonly state = computed(() => {
    if (!this.outbox.online()) return 'offline';
    if (this.outbox.pending() === 0) return 'idle';
    if (this.outbox.lastError()) return 'error';
    return this.outbox.syncing() ? 'syncing' : 'pending';
  });
}
