// apps/web/src/app/guards/auth.guards.ts — функциональные guard'ы, Angular 22 + RxJS 7
import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router, type CanMatchFn, type UrlTree } from '@angular/router';
import { filter, map, take, type Observable } from 'rxjs';
import { SessionStore } from '@web/entities/session';

/**
 * Ждём, пока Supabase восстановит сессию из localStorage (status: 'ready'),
 * иначе при перезагрузке страницы guard увидит session = null и выкинет на логин.
 */
function whenSessionReady(check: (isAuthenticated: boolean) => true | UrlTree): Observable<true | UrlTree> {
  const session = inject(SessionStore); // первый inject создаёт стор → onInit подписывается на auth
  return toObservable(session.status).pipe(
    filter((status) => status === 'ready'), // пропускаем 'loading'
    take(1),                                // одно решение — и отписка
    map(() => check(session.isAuthenticated())), // синхронный маппинг: switchMap не нужен, внутри нет запросов
  );
}

/** Закрытые разделы: без сессии → /login. canMatch, чтобы чанк страницы даже не грузился */
export const authGuard: CanMatchFn = () => {
  const router = inject(Router);
  return whenSessionReady((ok) => ok || router.createUrlTree(['/login']));
};

/** Экран входа: уже вошёл → в приложение */
export const guestGuard: CanMatchFn = () => {
  const router = inject(Router);
  return whenSessionReady((ok) => (ok ? router.createUrlTree(['/today']) : true));
};
