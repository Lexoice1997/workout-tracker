// apps/web/src/pages/login/ui/login.page.ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LoginForm } from '@web/features/auth-by-email';

@Component({
  selector: 'app-login-page',
  imports: [LoginForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6 py-8">
      <header class="flex flex-col gap-2">
        <div class="flex size-14 items-center justify-center rounded-2xl bg-stone-900">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"
               stroke-linecap="round" aria-hidden="true"><path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12" /></svg>
        </div>
        <h1 class="mt-2 text-[28px] font-bold">Дневник тренировок</h1>
        <p class="text-[15px] text-stone-600">Вход по email и паролю</p>
      </header>

      <app-login-form (signedIn)="goHome()" />

      <p class="text-[13px] text-stone-600">Регистрация закрыта: приложение только для владельца.</p>
    </main>
  `,
})
export class LoginPage {
  private readonly router = inject(Router);

  protected goHome(): void {
    void this.router.navigateByUrl('/today', { replaceUrl: true }); // «назад» не вернёт на логин
  }
}
