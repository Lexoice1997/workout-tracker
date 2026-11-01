create view public.last_normal_set_logs with (security_invoker = true) as
select distinct on (s.user_id, s.program_exercise_id) s.*, w.date
from public.set_logs s
  join public.workouts w on w.id = s.workout_id
where not w.is_deload and s.program_exercise_id is not null
order by s.user_id, s.program_exercise_id, w.date desc;
