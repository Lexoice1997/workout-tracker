// apps/web/src/entities/workout/api/offline/network-error.ts
/**
 * Ошибка «нет связи», а не «сервер отказал». Только такие ставим в очередь:
 * ошибку RLS или constraint повторять бессмысленно — её надо показать.
 * Тексты: Chrome «Failed to fetch», Safari «Load failed», Firefox «NetworkError…».
 */
export const isNetworkError = (e: unknown): boolean =>
  !navigator.onLine ||
  (e instanceof Error && /failed to fetch|load failed|networkerror|network request failed|fetch failed/i.test(e.message));
