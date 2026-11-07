// apps/web/src/pages/today/ui/today.page.ts — заглушка вечера 2
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-today-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-2">
      <h1 class="text-2xl font-bold">Сегодня</h1>
      <p class="text-sm text-stone-600">Здесь будут упражнения дня и план в кг — вечера 3–4.</p>
    </section>
  `,
})
export class TodayPage {}
