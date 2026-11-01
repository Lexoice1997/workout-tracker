do $$
declare t text;
begin
  -- только свои строки
  foreach t in array array['profiles','workouts','set_logs','body_metrics'] loop
    execute format('alter table public.%I enable row level security', t);
execute format(
  $p$create policy "own rows" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)$p$, t);
end loop;

  -- общее (user_id is null) читают все, пишут только своё
  foreach t in array array['exercises','programs','program_days','program_exercises'] loop
    execute format('alter table public.%I enable row level security', t);
execute format($p$create policy "read global and own" on public.%I for select to authenticated
      using (user_id is null or (select auth.uid()) = user_id)$p$, t);
execute format($p$create policy "insert own" on public.%I for insert to authenticated
      with check ((select auth.uid()) = user_id)$p$, t);
execute format($p$create policy "update own" on public.%I for update to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)$p$, t);
execute format($p$create policy "delete own" on public.%I for delete to authenticated
      using ((select auth.uid()) = user_id)$p$, t);
end loop;
end $$;
