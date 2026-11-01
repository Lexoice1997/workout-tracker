create extension if not exists moddatetime schema extensions;

create table public.profiles (
                               user_id  uuid primary key default auth.uid() references auth.users(id) on delete cascade,
                               timezone text not null default 'Asia/Tashkent'
);

-- Каталог: user_id null = общий, иначе личное упражнение
create table public.exercises (
                                id              uuid primary key default gen_random_uuid(),
                                user_id         uuid default auth.uid() references auth.users(id) on delete cascade,
                                name            text not null,
                                equipment       text not null check (equipment in ('barbell','dumbbell','machine','cable','bodyweight')),
                                default_step_kg numeric(4,2) check (default_step_kg > 0),
                                unique nulls not distinct (user_id, name)
);

create table public.programs (
                               id           uuid primary key default gen_random_uuid(),
                               user_id      uuid default auth.uid() references auth.users(id) on delete cascade,
                               title        text not null,
                               is_active    boolean not null default false,
                               cycle_start  date,
                               deload_every smallint not null default 6 check (deload_every between 3 and 12)
);
create unique index programs_one_active on public.programs (user_id) where is_active;

create table public.program_days (
                                   id         uuid primary key default gen_random_uuid(),
                                   user_id    uuid default auth.uid() references auth.users(id) on delete cascade,
                                   program_id uuid not null references public.programs(id) on delete cascade,
                                   code       text not null,
                                   title      text not null,
                                   weekday    smallint check (weekday between 1 and 7),
                                   sort       smallint not null default 0,
                                   unique (program_id, code)
);

create table public.program_exercises (
                                        id          uuid primary key default gen_random_uuid(),
                                        user_id     uuid default auth.uid() references auth.users(id) on delete cascade,
                                        day_id      uuid not null references public.program_days(id) on delete cascade,
                                        exercise_id uuid not null references public.exercises(id),
                                        sets        smallint not null check (sets between 1 and 10),
                                        rep_min     smallint not null check (rep_min > 0),
                                        rep_max     smallint not null check (rep_max >= rep_min),
                                        step_kg     numeric(4,2) check (step_kg > 0),
                                        start_kg    numeric(5,2),
                                        is_main     boolean not null default false,
                                        sort        smallint not null default 0
);

create table public.workouts (
                               id         uuid primary key,
                               user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
                               day_id     uuid references public.program_days(id) on delete set null,
                               day_title  text not null,
                               date       date not null,
                               is_deload  boolean not null default false,
                               cardio_min smallint check (cardio_min between 0 and 180),
                               note       text,
                               updated_at timestamptz not null default now(),
                               unique (user_id, day_id, date)
);

create table public.set_logs (
                               id                  uuid primary key,
                               user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
                               workout_id          uuid not null references public.workouts(id) on delete cascade,
                               program_exercise_id uuid references public.program_exercises(id) on delete set null,
                               exercise_id         uuid not null references public.exercises(id),
                               rep_min             smallint not null,
                               rep_max             smallint not null,
                               weight_kg           numeric(5,2) not null check (weight_kg >= 0),
                               reps                smallint[] not null check (cardinality(reps) between 1 and 10 and 0 <= all (reps)),
                               updated_at          timestamptz not null default now(),
                               unique (workout_id, program_exercise_id)
);
create index set_logs_user_exercise_idx on public.set_logs (user_id, exercise_id);
create index set_logs_slot_idx on public.set_logs (program_exercise_id);

create table public.body_metrics (
                                   id          uuid primary key default gen_random_uuid(),
                                   user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
                                   date        date not null,
                                   weight_kg   numeric(5,2),
                                   waist_cm    numeric(5,1),
                                   chest_cm    numeric(5,1),
                                   biceps_r_cm numeric(4,1),
                                   biceps_l_cm numeric(4,1),
                                   unique (user_id, date)
);

create trigger workouts_updated_at before update on public.workouts
  for each row execute procedure extensions.moddatetime (updated_at);
create trigger set_logs_updated_at before update on public.set_logs
  for each row execute procedure extensions.moddatetime (updated_at);
