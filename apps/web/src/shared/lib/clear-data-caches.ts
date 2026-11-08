// apps/web/src/shared/lib/clear-data-caches.ts — при выходе стереть закэшированные ответы API (ngsw dataGroups)
export async function clearDataCaches(): Promise<void> {
  try {
    const keys = await caches.keys();
    // ngsw называет кэши dataGroups примерно 'ngsw:/:1:data:dynamic:supabase-rest:cache'; оболочку приложения не трогаем
    await Promise.all(keys.filter((k) => k.includes(':data:')).map((k) => caches.delete(k)));
  } catch {
    /* Cache API нет (http, старый браузер) — нечего чистить */
  }
}
