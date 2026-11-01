create table public.goals (
                            id          uuid primary key default gen_random_uuid(),
                            user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
                            exercise_id uuid not null references public.exercises(id),
                            target_kg   numeric(5,2) not null check (target_kg > 0),
                            target_reps smallint not null check (target_reps between 1 and 15),
                            deadline    date not null,
                            achieved_at date
);
create unique index goals_one_active on public.goals (user_id, exercise_id) where achieved_at is null;

alter table public.goals enable row level security;
create policy "own rows" on public.goals for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
