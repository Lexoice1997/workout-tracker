import { InjectionToken, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@tracker/db-types';
import { environment } from '@web/shared/config/environment';

/** Типизированный клиент: .from('set_logs') знает колонки и типы */
export type Supabase = SupabaseClient<Database>;

export const SUPABASE = new InjectionToken<Supabase>('SUPABASE');

/** Один клиент на приложение; подключается в app.config.ts */
export const provideSupabase = (): EnvironmentProviders =>
  makeEnvironmentProviders([
    {
      provide: SUPABASE,
      useFactory: (): Supabase =>
        createClient<Database>(environment.supabaseUrl, environment.supabaseKey, {
          auth: { persistSession: true, autoRefreshToken: true }, // сессия в localStorage, рефреш сам
        }),
    },
  ]);
