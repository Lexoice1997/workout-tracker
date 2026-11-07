// apps/web/src/app/app.routes.ts
import type { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guards';

export const appRoutes: Routes = [
  {
    path: 'login',
    canMatch: [guestGuard],
    title: 'Вход',
    loadComponent: () => import('@web/pages/login').then((m) => m.LoginPage),
  },
  {
    path: '',
    canMatch: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'today' },
      { path: 'today', title: 'Сегодня', loadComponent: () => import('@web/pages/today').then((m) => m.TodayPage) },
      { path: 'history', title: 'История', loadComponent: () => import('@web/pages/history').then((m) => m.HistoryPage) },
      { path: 'progress', title: 'Прогресс', loadComponent: () => import('@web/pages/progress').then((m) => m.ProgressPage) },
      { path: 'body', title: 'Замеры', loadComponent: () => import('@web/pages/body').then((m) => m.BodyPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
