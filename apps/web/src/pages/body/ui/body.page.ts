// apps/web/src/pages/body/ui/body.page.ts — заглушка вечера 2
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-body-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-2">
      <h1 class="text-2xl font-bold">Замеры</h1>
      <p class="text-sm text-stone-600">Вес, живот, грудь, бицепс — вечер 7.</p>
    </section>
  `,
})
export class BodyPage {}
