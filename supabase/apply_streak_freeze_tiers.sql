-- Run in Supabase SQL Editor (migrations/012_streak_freeze_tiers.sql).`n`n-- Tiered streak freeze: 1, 2, 4, or 7 missed login days (escalating shop prices).

alter table public.users
  add column if not exists shop_streak_freeze_inventory_tiers jsonb not null default '{}'::jsonb,
  add column if not exists shop_streak_freeze_armed_days integer not null default 0;

comment on column public.users.shop_streak_freeze_inventory_tiers is
  'Map of freeze length (days as string keys) to token count, e.g. {"1":2,"7":1}.';
comment on column public.users.shop_streak_freeze_armed_days is
  'When > 0, next login sync bridges up to this many consecutive missed days (then resets to 0).';

-- Migrate legacy integer inventory + boolean armed into new columns.
update public.users u
set
  shop_streak_freeze_inventory_tiers = case
    when coalesce(u.shop_streak_freeze_inventory, 0) > 0 then
      jsonb_build_object('1', coalesce(u.shop_streak_freeze_inventory, 0))
    else coalesce(u.shop_streak_freeze_inventory_tiers, '{}'::jsonb)
  end,
  shop_streak_freeze_armed_days = greatest(
    coalesce(u.shop_streak_freeze_armed_days, 0),
    case when coalesce(u.shop_streak_freeze_armed, false) then 1 else 0 end
  )
where coalesce(u.shop_streak_freeze_inventory, 0) > 0
   or coalesce(u.shop_streak_freeze_armed, false);

create or replace function public.streak_freeze_tier_price(p_days integer)
returns integer
language sql
immutable
as $$
  select case p_days
    when 1 then 120
    when 2 then 240
    when 4 then 520
    when 7 then 950
    else null
  end;
$$;

create or replace function public.streak_freeze_tier_inventory(
  p_tiers jsonb,
  p_days integer
)
returns integer
language sql
immutable
as $$
  select coalesce((p_tiers ->> p_days::text)::integer, 0);
$$;

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
  tiers jsonb;
  freeze_days integer;
  tier_key text;
  tier_inv integer;
  max_per_tier integer := 3;
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
    coalesce(u.shop_nickname_trophies_owned, '{}'::text[]),
    coalesce(u.shop_streak_freeze_inventory_tiers, '{}'::jsonb)
  into pts, inv, owned, badge, mult_until, trophies, tiers
  from public.users u
  where u.id = uid
  for update;

  if not found then
    raise exception 'user profile not found';
  end if;

  if p_item_id like 'streak-freeze-%' then
    tier_key := replace(p_item_id, 'streak-freeze-', '');
    freeze_days := tier_key::integer;
    if freeze_days not in (1, 2, 4, 7) then
      raise exception 'invalid streak freeze tier';
    end if;
    price := public.streak_freeze_tier_price(freeze_days);
    tier_inv := public.streak_freeze_tier_inventory(tiers, freeze_days);
    if tier_inv >= max_per_tier then
      raise exception 'maximum streak freeze inventory reached for tier';
    end if;
    if pts < price then
      raise exception 'not enough points';
    end if;
    tiers := tiers || jsonb_build_object(tier_key, tier_inv + 1);
    update public.users
    set
      quiz_points_total = pts - price,
      shop_streak_freeze_inventory_tiers = tiers
    where id = uid;
    return jsonb_build_object(
      'ok', true,
      'item_id', p_item_id,
      'quiz_points_total', pts - price,
      'shop_streak_freeze_inventory_tiers', tiers
    );
  elsif p_item_id = 'streak-freeze' then
    -- Legacy item id → 1-day tier
    freeze_days := 1;
    price := public.streak_freeze_tier_price(1);
    tier_inv := public.streak_freeze_tier_inventory(tiers, 1);
    if tier_inv >= max_per_tier then
      raise exception 'maximum streak freeze inventory reached for tier';
    end if;
    if pts < price then
      raise exception 'not enough points';
    end if;
    tiers := tiers || jsonb_build_object('1', tier_inv + 1);
    update public.users
    set
      quiz_points_total = pts - price,
      shop_streak_freeze_inventory_tiers = tiers
    where id = uid;
    return jsonb_build_object(
      'ok', true,
      'item_id', 'streak-freeze-1',
      'quiz_points_total', pts - price,
      'shop_streak_freeze_inventory_tiers', tiers
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

drop function if exists public.arm_streak_freeze();

create or replace function public.arm_streak_freeze(p_days integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tiers jsonb;
  tier_inv integer;
  armed_days integer;
  tier_key text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_days not in (1, 2, 4, 7) then
    raise exception 'invalid streak freeze tier';
  end if;

  tier_key := p_days::text;

  select
    coalesce(u.shop_streak_freeze_inventory_tiers, '{}'::jsonb),
    coalesce(u.shop_streak_freeze_armed_days, 0)
  into tiers, armed_days
  from public.users u
  where u.id = uid
  for update;

  if not found then
    raise exception 'user profile not found';
  end if;
  if armed_days > 0 then
    raise exception 'streak freeze already armed';
  end if;

  tier_inv := public.streak_freeze_tier_inventory(tiers, p_days);
  if tier_inv < 1 then
    raise exception 'no streak freeze in inventory for tier';
  end if;

  tiers := tiers || jsonb_build_object(tier_key, tier_inv - 1);

  update public.users
  set
    shop_streak_freeze_inventory_tiers = tiers,
    shop_streak_freeze_armed_days = p_days
  where id = uid;

  return jsonb_build_object(
    'ok', true,
    'shop_streak_freeze_inventory_tiers', tiers,
    'shop_streak_freeze_armed_days', p_days
  );
end;
$$;

grant execute on function public.arm_streak_freeze(integer) to authenticated;

