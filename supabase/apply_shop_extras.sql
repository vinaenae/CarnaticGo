-- Shop extras: 1.5× quiz points (30 min), nickname trophies, daily practice tracking.

-- ----- Daily practice (sing-with-tāla minutes, synced from client) -----
create table if not exists public.user_daily_practice (
  user_id uuid not null references public.users (id) on delete cascade,
  day date not null,
  practice_ms integer not null default 0 check (practice_ms >= 0 and practice_ms <= 86400000),
  primary key (user_id, day)
);

create index if not exists user_daily_practice_user_day_desc_idx
  on public.user_daily_practice (user_id, day desc);

alter table public.user_daily_practice enable row level security;

drop policy if exists "Users read own practice" on public.user_daily_practice;
create policy "Users read own practice"
  on public.user_daily_practice for select using (auth.uid() = user_id);

drop policy if exists "Users insert own practice" on public.user_daily_practice;
create policy "Users insert own practice"
  on public.user_daily_practice for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own practice" on public.user_daily_practice;
create policy "Users update own practice"
  on public.user_daily_practice for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----- Shop columns -----
alter table public.users
  add column if not exists shop_points_multiplier_until timestamptz,
  add column if not exists shop_nickname_trophy text,
  add column if not exists shop_nickname_trophies_owned text[] not null default '{}';

comment on column public.users.shop_points_multiplier_until is
  'While in the future, quiz point awards are multiplied by 1.5×.';
comment on column public.users.shop_nickname_trophy is
  'Equipped nickname trophy id (leaderboard display).';
comment on column public.users.shop_nickname_trophies_owned is
  'Purchased nickname trophy ids.';

-- ----- Practice sync -----
create or replace function public.sync_user_practice_day(
  p_day date,
  p_total_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  capped integer;
  prev integer;
  next_ms integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_day is null then
    raise exception 'day required';
  end if;

  capped := greatest(0, least(coalesce(p_total_ms, 0), 86400000));

  select coalesce(udp.practice_ms, 0)
  into prev
  from public.user_daily_practice udp
  where udp.user_id = uid and udp.day = p_day
  for update;

  next_ms := greatest(coalesce(prev, 0), capped);

  insert into public.user_daily_practice (user_id, day, practice_ms)
  values (uid, p_day, next_ms)
  on conflict (user_id, day) do update
  set practice_ms = excluded.practice_ms;

  return jsonb_build_object(
    'ok', true,
    'day', p_day,
    'practice_ms', next_ms
  );
end;
$$;

grant execute on function public.sync_user_practice_day(date, integer) to authenticated;

-- 15+ minutes per day for 7 consecutive days ending on p_anchor_day (inclusive).
create or replace function public.has_seven_day_practice_streak(p_anchor_day date default null)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  uid uuid := auth.uid();
  anchor date := coalesce(p_anchor_day, (timezone('utc', now()))::date);
  i integer;
  d date;
  ms integer;
  goal integer := 900000;
begin
  if uid is null then
    return false;
  end if;

  for i in 0..6 loop
    d := anchor - i;
    select coalesce(udp.practice_ms, 0)
    into ms
    from public.user_daily_practice udp
    where udp.user_id = uid and udp.day = d;

    if ms is null or ms < goal then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

grant execute on function public.has_seven_day_practice_streak(date) to authenticated;

-- ----- Quiz points with optional 1.5× multiplier -----
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
  mult_until timestamptz;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select
    coalesce(u.quiz_correct_streak, 0),
    coalesce(u.quiz_points_total, 0),
    u.shop_points_multiplier_until
  into prior_streak, total, mult_until
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

  if awarded > 0 and mult_until is not null and mult_until > now() then
    awarded := round(awarded * 1.5);
  end if;

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

-- ----- Purchase shop item (extended) -----
create or replace function public.purchase_shop_item(
  p_item_id text,
  p_badge_id text default null,
  p_anchor_day date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pts integer;
  price integer;
  inv integer;
  owned boolean;
  badge text;
  mult_until timestamptz;
  trophies text[];
  anchor date := coalesce(p_anchor_day, (timezone('utc', now()))::date);
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select
    coalesce(u.quiz_points_total, 0),
    coalesce(u.shop_streak_freeze_inventory, 0),
    coalesce(u.shop_shruti_box_owned, false),
    u.shop_profile_badge,
    u.shop_points_multiplier_until,
    coalesce(u.shop_nickname_trophies_owned, '{}'::text[])
  into pts, inv, owned, badge, mult_until, trophies
  from public.users u
  where u.id = uid
  for update;

  if not found then
    raise exception 'user profile not found';
  end if;

  if p_item_id = 'streak-freeze' then
    price := 120;
    if inv >= 5 then
      raise exception 'maximum streak freeze inventory reached';
    end if;
    if pts < price then
      raise exception 'not enough points';
    end if;
    update public.users
    set
      quiz_points_total = pts - price,
      shop_streak_freeze_inventory = inv + 1
    where id = uid;
    return jsonb_build_object(
      'ok', true,
      'item_id', p_item_id,
      'quiz_points_total', pts - price,
      'shop_streak_freeze_inventory', inv + 1
    );
  elsif p_item_id = 'shruti-box' then
    price := 350;
    if owned then
      raise exception 'already owned';
    end if;
    if pts < price then
      raise exception 'not enough points';
    end if;
    update public.users
    set quiz_points_total = pts - price, shop_shruti_box_owned = true
    where id = uid;
    return jsonb_build_object(
      'ok', true,
      'item_id', p_item_id,
      'quiz_points_total', pts - price,
      'shop_shruti_box_owned', true
    );
  elsif p_item_id = 'profile-badge' then
    price := 180;
    if p_badge_id is null or p_badge_id not in ('raga-star', 'tala-pulse', 'shruti-moon') then
      raise exception 'invalid badge';
    end if;
    if badge is not null then
      raise exception 'profile badge already unlocked';
    end if;
    if pts < price then
      raise exception 'not enough points';
    end if;
    update public.users
    set quiz_points_total = pts - price, shop_profile_badge = p_badge_id
    where id = uid;
    return jsonb_build_object(
      'ok', true,
      'item_id', p_item_id,
      'quiz_points_total', pts - price,
      'shop_profile_badge', p_badge_id
    );
  elsif p_item_id = 'points-multiplier' then
    price := 140;
    if pts < price then
      raise exception 'not enough points';
    end if;
    update public.users
    set
      quiz_points_total = pts - price,
      shop_points_multiplier_until = now() + interval '30 minutes'
    where id = uid;
    return jsonb_build_object(
      'ok', true,
      'item_id', p_item_id,
      'quiz_points_total', pts - price,
      'shop_points_multiplier_until', now() + interval '30 minutes'
    );
  elsif p_item_id = 'nickname-trophy' then
    price := 220;
    if p_badge_id is null or p_badge_id not in ('tala-champion', 'shruti-hero') then
      raise exception 'invalid nickname trophy';
    end if;
    if p_badge_id = any (trophies) then
      raise exception 'nickname trophy already owned';
    end if;
    if not public.has_seven_day_practice_streak(anchor) then
      raise exception 'practice streak requirement not met';
    end if;
    if pts < price then
      raise exception 'not enough points';
    end if;
    update public.users
    set
      quiz_points_total = pts - price,
      shop_nickname_trophies_owned = array_append(trophies, p_badge_id),
      shop_nickname_trophy = p_badge_id
    where id = uid;
    return jsonb_build_object(
      'ok', true,
      'item_id', p_item_id,
      'quiz_points_total', pts - price,
      'shop_nickname_trophy', p_badge_id,
      'shop_nickname_trophies_owned', array_append(trophies, p_badge_id)
    );
  else
    raise exception 'unknown shop item';
  end if;
end;
$$;

create or replace function public.equip_nickname_trophy(p_trophy_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  trophies text[];
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_trophy_id is null or p_trophy_id not in ('tala-champion', 'shruti-hero') then
    raise exception 'invalid nickname trophy';
  end if;

  select coalesce(u.shop_nickname_trophies_owned, '{}'::text[])
  into trophies
  from public.users u
  where u.id = uid
  for update;

  if not found then
    raise exception 'user profile not found';
  end if;
  if not (p_trophy_id = any (trophies)) then
    raise exception 'nickname trophy not owned';
  end if;

  update public.users set shop_nickname_trophy = p_trophy_id where id = uid;

  return jsonb_build_object('ok', true, 'shop_nickname_trophy', p_trophy_id);
end;
$$;

grant execute on function public.equip_nickname_trophy(text) to authenticated;

-- Leaderboard: nickname trophy
drop function if exists public.get_friends_points_leaderboard();

create or replace function public.get_friends_points_leaderboard()
returns table (
  rank bigint,
  user_id uuid,
  username text,
  first_name text,
  quiz_points_total integer,
  quiz_correct_streak integer,
  shop_profile_badge text,
  shop_nickname_trophy text,
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
      u.shop_profile_badge,
      u.shop_nickname_trophy,
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
      u.shop_profile_badge,
      u.shop_nickname_trophy,
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
    ranked.shop_profile_badge,
    ranked.shop_nickname_trophy,
    ranked.is_self
  from ranked
  order by ranked.rank;
$$;

grant execute on function public.get_friends_points_leaderboard() to authenticated;

grant execute on function public.purchase_shop_item(text, text, date) to authenticated;
