-- +5 quiz points after 15 min voice-active sing-with-tāla (once per calendar day).

alter table public.users
  add column if not exists sing_tala_bonus_day date;

comment on column public.users.sing_tala_bonus_day is
  'Last calendar day the +5 sing-with-tāla practice bonus was granted.';

create or replace function public.award_sing_tala_practice_bonus(p_day date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pts integer;
  bonus_day date;
  day date := coalesce(p_day, (timezone('utc', now()))::date);
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(u.quiz_points_total, 0), u.sing_tala_bonus_day
  into pts, bonus_day
  from public.users u
  where u.id = uid
  for update;

  if not found then
    raise exception 'user profile not found';
  end if;

  if bonus_day = day then
    return jsonb_build_object(
      'ok', true,
      'already_awarded_today', true,
      'points_awarded', 0,
      'quiz_points_total', pts
    );
  end if;

  pts := pts + 5;

  update public.users
  set quiz_points_total = pts, sing_tala_bonus_day = day
  where id = uid;

  return jsonb_build_object(
    'ok', true,
    'already_awarded_today', false,
    'points_awarded', 5,
    'quiz_points_total', pts
  );
end;
$$;

grant execute on function public.award_sing_tala_practice_bonus(date) to authenticated;
