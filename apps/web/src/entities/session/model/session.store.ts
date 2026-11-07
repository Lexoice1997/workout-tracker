// apps/web/src/entities/session/model/session.store.ts — @ngrx/signals 22, Angular 22
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import type { Session } from '@supabase/supabase-js';
import { SUPABASE } from '@web/shared/api';

interface SessionState {
  readonly session: Session | null;
  /** loading — Supabase ещё не восстановил сессию из localStorage; guard ждёт ready */
  readonly status: 'loading' | 'ready';
}

const AUTH_ERRORS: Readonly<Record<string, string>> = {
  'Invalid login credentials': 'Неверный email или пароль',
  'Email not confirmed': 'Email не подтверждён — подтверди пользователя в панели Supabase',
};

/** Единственный глобальный стор приложения */
export const SessionStore = signalStore(
  { providedIn: 'root' },
  withState<SessionState>({ session: null, status: 'loading' }),
  withComputed(({ session }) => ({
    userId: computed(() => session()?.user.id ?? null),
    email: computed(() => session()?.user.email ?? null),
    isAuthenticated: computed(() => session() !== null),
  })),
  withMethods((store, sb = inject(SUPABASE)) => ({
    /** null — успех; строка — текст ошибки для формы */
    async signIn(email: string, password: string): Promise<string | null> {
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return AUTH_ERRORS[error.message] ?? error.message;
      // onAuthStateChange тоже выставит сессию — дублируем, чтобы guard после navigate видел её сразу
      patchState(store, { session: data.session, status: 'ready' });
      return null;
    },
    async signOut(): Promise<void> {
      await sb.auth.signOut();
      patchState(store, { session: null });
    },
  })),
  withHooks((store, sb = inject(SUPABASE)) => {
    let unsubscribe: (() => void) | undefined;
    return {
      onInit() {
        // Первым событием придёт INITIAL_SESSION: сессия из localStorage или null.
        // ВАЖНО: внутри колбэка не вызывать sb.* и не делать await — клиент держит lock.
        const { data } = sb.auth.onAuthStateChange((_event, session) => {
          patchState(store, { session, status: 'ready' });
        });
        unsubscribe = () => data.subscription.unsubscribe();
      },
      onDestroy() {
        unsubscribe?.();
      },
    };
  }),
);
