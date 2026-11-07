// apps/web/src/features/auth-by-email/ui/login-form.ts — Angular 22, typed reactive forms
import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SessionStore } from '@web/entities/session';
import { UiButton } from '@web/shared/ui';

const INPUT =
  'h-12 w-full rounded-xl border border-stone-300 bg-white px-3.5 text-base text-stone-900 ' +
  'outline-none focus:border-accent focus:ring-2 focus:ring-accent/30';

@Component({
  selector: 'app-login-form',
  imports: [ReactiveFormsModule, UiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-5" novalidate>
      <div class="flex flex-col gap-2">
        <label for="email" class="text-sm font-medium">Email</label>
        <input id="email" type="email" formControlName="email" autocomplete="email"
               inputmode="email" autocapitalize="none" class="${INPUT}" />
      </div>

      <div class="flex flex-col gap-2">
        <label for="password" class="text-sm font-medium">Пароль</label>
        <div class="relative">
          <input id="password" formControlName="password" autocomplete="current-password"
                 [type]="showPassword() ? 'text' : 'password'" class="${INPUT} pr-12" />
          <button type="button" class="absolute top-0.5 right-0.5 flex size-11 items-center justify-center text-stone-600"
                  [attr.aria-label]="showPassword() ? 'Скрыть пароль' : 'Показать пароль'"
                  [attr.aria-pressed]="showPassword()" (click)="showPassword.update((v) => !v)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
        @if (error(); as message) {
          <p role="alert" class="text-sm text-red-700">{{ message }}</p>
        }
      </div>

      <button uiButton type="submit" [disabled]="pending()">
        {{ pending() ? 'Входим…' : 'Войти' }}
      </button>
    </form>
  `,
})
export class LoginForm {
  private readonly session = inject(SessionStore);

  /** Страница решает, куда вести после входа: фича не знает про роуты */
  readonly signedIn = output<void>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.error.set('Введи email и пароль');
      return;
    }
    if (this.pending()) return; // защита от двойного тапа
    this.pending.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    const message = await this.session.signIn(email, password);
    this.pending.set(false);
    if (message) this.error.set(message);
    else this.signedIn.emit();
  }
}
