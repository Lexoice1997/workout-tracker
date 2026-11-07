// apps/web/src/app/app.ts — корень: баннер обновления + router-outlet
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UpdateBanner } from './layout/update-banner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UpdateBanner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-update-banner /><router-outlet />`,
})
export class App {}
