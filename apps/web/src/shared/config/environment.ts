// apps/web/src/shared/config/environment.ts
// Ключ публичный (publishable/anon): данные защищает RLS, а не секретность ключа.
// НИКОГДА не клади сюда service_role / secret key.
export const environment = {
  supabaseUrl: 'https://msecftduxfzbtgihsyem.supabase.co',
  supabaseKey: 'sb_publishable_pSSYJ8QtMxJfPOHoSOdLMw_KMXk2ckv',
} as const;
