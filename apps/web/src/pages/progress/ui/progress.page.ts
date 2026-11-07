// apps/web/src/pages/progress/ui/progress.page.ts — заглушка вечера 2
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-progress-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-2">
      <h1 class="text-2xl font-bold">Прогресс</h1>
      <p class="text-sm text-stone-600">Рабочие веса и темп к цели — вечер 8.</p>
    </section>
  `,
})
export class ProgressPage {}
