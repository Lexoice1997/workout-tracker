// apps/web/src/app/layout/shell.ts — оболочка закрытой части: навигация + контент
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppNav } from '@web/widgets/app-nav';
import { SyncStatus } from '@web/widgets/sync-status';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, AppNav, SyncStatus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh flex-wrap lg:flex-nowrap">
      <app-nav />
      <!-- pb-24: место под нижнюю навигацию на телефоне -->
      <main class="min-w-0 flex-1 px-4 pt-5 pb-24 lg:px-8 lg:pt-8 lg:pb-8">
        <div class="mx-auto max-w-2xl lg:max-w-5xl"><app-sync-status /></div>
        <router-outlet />
      </main>
    </div>
  `,
})
export class Shell {}
