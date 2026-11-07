// apps/web/src/app/layout/update-banner.ts — «Доступна новая версия»: service worker отдаёт кэш,
// поэтому после деплоя телефон продолжает показывать старую версию, пока не перезагрузишь.
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, type VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

@Component({
  selector: 'app-update-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ready()) {
      <div role="status" class="fixed inset-x-3 top-3 z-20 flex items-center justify-between gap-3 rounded-xl bg-stone-900 px-4 py-3 text-sm text-white shadow-lg">
        <span>Доступна новая версия</span>
        <button type="button" class="h-9 rounded-lg bg-white px-3 font-semibold text-stone-900" (click)="reload()">Обновить</button>
      </div>
    }
  `,
})
export class UpdateBanner {
  protected readonly ready = signal(false);

  constructor() {
    const sw = inject(SwUpdate);
    if (!sw.isEnabled) return; // dev-сервер: service worker выключен
    sw.versionUpdates
      .pipe(
        filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'), // новая версия скачана и готова
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.ready.set(true));
  }

  protected reload(): void {
    document.location.reload(); // SW активирует новую версию при перезагрузке
  }
}
