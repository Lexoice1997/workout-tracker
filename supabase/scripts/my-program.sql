do $$
declare
  uid uuid;
  pid uuid;
  slots_count int;
begin
  -- пользователь: единственный в проекте, email не нужен
  select id into uid from auth.users order by created_at limit 1;
  if uid is null then
    raise exception 'В auth.users нет пользователей: Authentication → Users → Add user (Auto Confirm)';
  end if;

  if exists (select 1 from public.programs where user_id = uid) then
    raise exception 'У пользователя % уже есть программа — повторно заливать не нужно', uid;
  end if;

  insert into public.programs (user_id, title, is_active, cycle_start)
  values (uid, 'Верх / низ, 4 раза в неделю', true, date '2026-10-26')
  returning id into pid;

  insert into public.program_days (user_id, program_id, code, title, weekday, sort) values
    (uid, pid, 'mon-lower-a', 'Низ A (тяжёлый)',  1, 1),
    (uid, pid, 'tue-upper-b', 'Верх B (объём)',   2, 2),
    (uid, pid, 'fri-lower-b', 'Низ B (объём)',    5, 5),
    (uid, pid, 'sat-upper-a', 'Верх A (тяжёлый)', 6, 6);

  insert into public.program_exercises (user_id, day_id, exercise_id, sets, rep_min, rep_max, start_kg, is_main, sort)
  select uid, d.id, e.id, s.sets, s.rep_min, s.rep_max, s.start_kg, s.is_main, s.sort
  from (values
    ('mon-lower-a', 'Присед со штангой',             4,  5,  6, 95,   true,  1),
    ('mon-lower-a', 'Гиперэкстензия с весом',        3, 10, 12, null, false, 2),
    ('mon-lower-a', 'Жим ногами',                    3, 10, 12, null, false, 3),
    ('mon-lower-a', 'Сгибания ног лёжа',             3, 10, 12, null, false, 4),
    ('mon-lower-a', 'Подъёмы на носки стоя',         4, 12, 15, null, false, 5),
    ('mon-lower-a', 'Ролик или планка',              3, 10, 10, null, false, 6),
    ('tue-upper-b', 'Жим штанги лёжа',               4,  8, 10, 72.5, false, 1),
    ('tue-upper-b', 'Бабочка (пек-дек)',             3, 12, 15, null, false, 2),
    ('tue-upper-b', 'Тяга одной рукой в тренажёре',  3, 10, 10, null, false, 3),
    ('tue-upper-b', 'Тяга верхнего блока узким',     3, 10, 12, null, false, 4),
    ('tue-upper-b', 'Скотт EZ',                      3, 10, 12, 26,   false, 5),
    ('tue-upper-b', 'Махи гантелями в стороны',      4, 12, 15, null, false, 6),
    ('tue-upper-b', 'Обратная бабочка',              3, 15, 15, null, false, 7),
    ('fri-lower-b', 'Присед со штангой',             3,  8, 10, 80,   false, 1),
    ('fri-lower-b', 'Болгарские выпады',             3,  8, 10, 16,   false, 2),
    ('fri-lower-b', 'Разгибания ног',                3, 12, 15, null, false, 3),
    ('fri-lower-b', 'Сгибания ног сидя',             3, 12, 15, null, false, 4),
    ('fri-lower-b', 'Подъёмы ног в висе',            3, 10, 12, null, false, 5),
    ('sat-upper-a', 'Жим штанги лёжа',               4,  5,  6, 85,   true,  1),
    ('sat-upper-a', 'Тяга с упором грудью',          4,  8, 10, null, false, 2),
    ('sat-upper-a', 'Жим гантелей на наклонной 30°', 3,  8, 10, 30,   true,  3),
    ('sat-upper-a', 'Тяга верхнего блока к груди',   3,  8, 10, null, false, 4),
    ('sat-upper-a', 'Тяга каната к лицу',            3, 15, 15, null, false, 5),
    ('sat-upper-a', 'Скотт EZ',                      3,  6,  8, 32,   true,  6),
    ('sat-upper-a', 'Трицепс в блоке, канат',        3, 10, 12, null, false, 7),
    ('sat-upper-a', 'Махи гантелями в стороны',      3, 12, 15, null, false, 8)
  ) as s(code, name, sets, rep_min, rep_max, start_kg, is_main, sort)
  join public.program_days d on d.program_id = pid and d.code = s.code
  join public.exercises e on e.name = s.name and e.user_id is null;

  get diagnostics slots_count = row_count;
  if slots_count <> 26 then
    raise exception 'Вставилось % слотов из 26 — не совпало название упражнения с каталогом', slots_count;
  end if;

  insert into public.profiles (user_id) values (uid) on conflict (user_id) do nothing;

  raise notice 'Готово: программа %, 4 дня, 26 слотов', pid;
end $$;