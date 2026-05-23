-- Quiz points (server-side) and friends leaderboard by total points.

alter table public.users
  add column if not exists quiz_points_total integer not null default 0;

alter table public.users
  add column if not exists quiz_correct_streak integer not null default 0;

comment on column public.users.quiz_points_total is
  'Lifetime quiz points (attempts + correct + consecutive-correct bonuses).';
comment on column public.users.quiz_correct_streak is
  'Consecutive correct quiz answers; resets on wrong (used for streak bonus).';

-- 1 attempt + 2 correct + max(0, new_streak - 1) streak bonus
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

create or replace function public.get_friends_points_leaderboard()
returns table (
  rank bigint,
  user_id uuid,
  username text,
  first_name text,
  quiz_points_total integer,
  quiz_correct_streak integer,
  is_self boolean
)
language sql
security definer
set search_path = public
stable
as $$
  with pool as (
    select
      u.id,
      u.username,
      u.first_name,
      coalesce(u.quiz_points_total, 0) as quiz_points_total,
      coalesce(u.quiz_correct_streak, 0) as quiz_correct_streak,
      true as is_self
    from public.users u
    where u.id = auth.uid()
    union all
    select
      u.id,
      u.username,
      u.first_name,
      coalesce(u.quiz_points_total, 0),
      coalesce(u.quiz_correct_streak, 0),
      false
    from public.user_friendships f
    join public.users u on u.id = f.friend_id
    where f.user_id = auth.uid()
  ),
  ranked as (
    select
      row_number() over (
        order by
          quiz_points_total desc,
          lower(coalesce(username, '')),
          id
      ) as rank,
      pool.*
    from pool
  )
  select
    ranked.rank,
    ranked.id as user_id,
    ranked.username,
    ranked.first_name,
    ranked.quiz_points_total,
    ranked.quiz_correct_streak,
    ranked.is_self
  from ranked
  order by ranked.rank;
$$;

grant execute on function public.get_friends_points_leaderboard() to authenticated;
