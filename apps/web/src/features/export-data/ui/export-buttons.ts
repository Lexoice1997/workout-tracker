// apps/web/src/features/export-data/ui/export-buttons.ts — скачать всё в JSON (бэкап) или CSV (таблица)
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { todayLocal } from '@web/shared/lib/local-date';
import { UiButton } from '@web/shared/ui';
import { ExportSource } from '../api/export-source';
import { exportFileName, toCsv } from '../model/export';

@Component({
  selector: 'app-export-buttons',
  imports: [UiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap gap-2">
        <button uiButton="secondary" size="md" type="button" class="flex-1" [disabled]="busy() !== null" (click)="run('json')">
          {{ busy() === 'json' ? 'Собираю…' : 'Бэкап JSON' }}
        </button>
        <button uiButton="secondary" size="md" type="button" class="flex-1" [disabled]="busy() !== null" (click)="run('csv')">
          {{ busy() === 'csv' ? 'Собираю…' : 'Таблица CSV' }}
        </button>
      </div>
      @if (done()) { <p class="text-[13px] text-green-700" role="status">{{ done() }}</p> }
      @if (error()) { <p class="text-[13px] text-red-700" role="alert">{{ error() }}</p> }
    </div>
  `,
})
export class ExportButtons {
  private readonly source = inject(ExportSource);
  protected readonly busy = signal<'json' | 'csv' | null>(null);
  protected readonly done = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected async run(kind: 'json' | 'csv'): Promise<void> {
    if (this.busy()) return;
    this.busy.set(kind);
    this.done.set(null);
    this.error.set(null);
    try {
      const bundle = await this.source.bundle();
      const body = kind === 'json' ? JSON.stringify(bundle, null, 2) : toCsv(bundle.workouts);
      const type = kind === 'json' ? 'application/json' : 'text/csv;charset=utf-8';
      const name = exportFileName(kind, todayLocal());
      const how = await deliver(new File([body], name, { type }));
      this.done.set(`${how === 'shared' ? 'Отправлено' : 'Скачано'}: ${name} · тренировок ${bundle.workouts.length}`);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // закрыл меню «Поделиться»
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy.set(null);
    }
  }
}

/**
 * Телефон: системное «Поделиться» → «Сохранить в Файлы» / Telegram. В PWA на iOS обычное скачивание часто молча не срабатывает.
 * Десктоп: обычное скачивание.
 */
async function deliver(file: File): Promise<'shared' | 'downloaded'> {
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: file.name });
    return 'shared';
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // сразу отзывать нельзя: Safari не успевает начать скачивание
  return 'downloaded';
}
