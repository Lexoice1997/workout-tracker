// apps/web/src/pages/history/ui/history.page.ts — заглушка вечера 2
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-history-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-2">
      <h1 class="text-2xl font-bold">История</h1>
      <p class="text-sm text-stone-600">Тренировки по неделям — вечер 7.</p>
    </section>
  `,
})
export class HistoryPage {}
