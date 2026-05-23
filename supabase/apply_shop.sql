-- Run in Supabase → SQL Editor (same as migrations/009_shop.sql).

alter table public.users
  add column if not exists shop_streak_freeze_inventory integer not null default 0,
  add column if not exists shop_streak_freeze_armed boolean not null default false,
  add column if not exists shop_shruti_box_owned boolean not null default false,
  add column if not exists shop_profile_badge text;

create or replace function public.purchase_shop_item(
  p_item_id text,
  p_badge_id text default null
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
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(u.quiz_points_total, 0),
         coalesce(u.shop_streak_freeze_inventory, 0),
         coalesce(u.shop_shruti_box_owned, false),
         u.shop_profile_badge
  into pts, inv, owned, badge
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
  else
    raise exception 'unknown shop item';
  end if;
end;
$$;

grant execute on function public.purchase_shop_item(text, text) to authenticated;

create or replace function public.arm_streak_freeze()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv integer;
  armed boolean;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(u.shop_streak_freeze_inventory, 0),
         coalesce(u.shop_streak_freeze_armed, false)
  into inv, armed
  from public.users u
  where u.id = uid
  for update;

  if not found then
    raise exception 'user profile not found';
  end if;
  if inv < 1 then
    raise exception 'no streak freeze in inventory';
  end if;
  if armed then
    raise exception 'streak freeze already armed';
  end if;

  update public.users
  set
    shop_streak_freeze_inventory = inv - 1,
    shop_streak_freeze_armed = true
  where id = uid;

  return jsonb_build_object(
    'ok', true,
    'shop_streak_freeze_inventory', inv - 1,
    'shop_streak_freeze_armed', true
  );
end;
$$;

grant execute on function public.arm_streak_freeze() to authenticated;

create or replace function public.equip_profile_badge(p_badge_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_badge text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_badge_id is not null and p_badge_id not in ('raga-star', 'tala-pulse', 'shruti-moon') then
    raise exception 'invalid badge';
  end if;

  select u.shop_profile_badge into current_badge
  from public.users u
  where u.id = uid
  for update;

  if not found then
    raise exception 'user profile not found';
  end if;
  if current_badge is null then
    raise exception 'profile badge not unlocked';
  end if;

  update public.users set shop_profile_badge = p_badge_id where id = uid;

  return jsonb_build_object('ok', true, 'shop_profile_badge', p_badge_id);
end;
$$;

grant execute on function public.equip_profile_badge(text) to authenticated;

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
    ranked.is_self
  from ranked
  order by ranked.rank;
$$;

grant execute on function public.get_friends_points_leaderboard() to authenticated;
