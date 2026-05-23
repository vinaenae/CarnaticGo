-- Quiz points only. Prefer supabase/apply_full_schema.sql for a single paste-in script.
-- Safe to run more than once.

alter table public.users
  add column if not exists quiz_points_total integer not null default 0;

alter table public.users
  add column if not exists quiz_correct_streak integer not null default 0;

-- Correct: +1 plus +1 per prior consecutive correct. Wrong: -1. Balance never below 0.
create or replace function public.quiz_points_for_answer(p_correct boolean, p_prior_streak integer)
returns integer
language sql
immutable
as $$
  select
    case
      when p_correct then 1 + greatest(0, p_prior_streak)
      else -1
    end;
$$;

create or replace function public.award_quiz_points(p_correct boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prior_streak integer;
  new_streak integer;
  awarded integer;
  total integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(u.quiz_correct_streak, 0), coalesce(u.quiz_points_total, 0)
  into prior_streak, total
  from public.users u
  where u.id = uid
  for update;

  if not found then
    raise exception 'user profile not found';
  end if;

  if p_correct then
    new_streak := prior_streak + 1;
  else
    new_streak := 0;
  end if;

  awarded := public.quiz_points_for_answer(p_correct, prior_streak);
  total := greatest(0, total + awarded);

  update public.users
  set
    quiz_points_total = total,
    quiz_correct_streak = new_streak
  where id = uid;

  return jsonb_build_object(
    'points_awarded', awarded,
    'quiz_points_total', total,
    'quiz_correct_streak', new_streak
  );
end;
$$;

grant execute on function public.award_quiz_points(boolean) to authenticated;

notify pgrst, 'reload schema';
