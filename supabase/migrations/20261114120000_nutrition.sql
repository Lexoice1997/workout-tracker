-- 20261114120000_nutrition.sql — модуль «Питание»: приёмы пищи и цели по КБЖУ
-- Применять в SQL Editor или supabase db push. Ядро тренировок не трогает.

-- Цели на день — в профиле. Строки профиля может не быть: клиент делает upsert по user_id.
alter table public.profiles
  add column if not exists kcal_target      smallint check (kcal_target between 800 and 8000),
  add column if not exists protein_target_g smallint check (protein_target_g between 20 and 500);

-- Приём пищи. Состав — jsonb (что распознал Claude или ввёл руками), итоги — колонки ради простых сумм.
create table public.meals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date       date not null,                                 -- локальная дата, не UTC
  slot       text not null check (slot in ('breakfast','lunch','dinner','snack')),
  title      text not null check (char_length(title) between 1 and 120),
  -- [{ "name": "Рис отварной", "grams": 150, "kcal": 195, "protein": 4, "fat": 0.5, "carbs": 42 }, …]
  items      jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  kcal       numeric(6,1) not null check (kcal >= 0),
  protein_g  numeric(5,1) not null check (protein_g >= 0),
  fat_g      numeric(5,1) not null check (fat_g >= 0),
  carbs_g    numeric(5,1) not null check (carbs_g >= 0),
  source     text not null default 'manual' check (source in ('photo','manual')),
  note       text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index meals_user_date_idx on public.meals (user_id, date);

alter table public.meals enable row level security;
create policy "own rows" on public.meals for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
