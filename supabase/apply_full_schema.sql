-- =============================================================================
-- CarnaticGo — FULL schema (paste entire file in Supabase → SQL Editor → Run)
-- Use this if you get: relation "public.users" does not exist
-- Safe to run more than once (idempotent).
--
-- Includes:
--   1. Core (users, sessions, metrics, daily engagement)
--   2. Usernames + friends + RLS
--   3. Auth helpers + streak/points leaderboards
--   4. Quiz points (+1 correct + streak bonus, -1 wrong; 1.5× shop boost)
--   5. Shop (tiered streak freeze, shruti box, badge, points boost, nickname trophies)
--   6. Daily practice tracking (sing-with-tāla minutes for trophy eligibility)
--   7. Sing-with-tāla +5 quiz bonus (once per calendar day via RPC)
--   8. Hold-the-swara bests (per shruti key)
--
-- Not in Supabase (browser only):
--   • Past practice sessions list on home (localStorage)
--   • In-progress stopwatch while navigating warmup ↔ sing-with-tāla (sessionStorage)
-- =============================================================================

-- ----- 1. Core tables -----
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  first_name text,
  username text,
  login_streak_current integer not null default 0,
  login_streak_best integer not null default 0,
  last_login_day date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users add column if not exists first_name text;
alter table public.users add column if not exists username text;
alter table public.users add column if not exists login_streak_current integer not null default 0;
alter table public.users add column if not exists login_streak_best integer not null default 0;
alter table public.users add column if not exists last_login_day date;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null default 'Practice',
  shruti_frequency double precision not null,
  bpm integer not null,
  tanpura_key text,
  pitch_data jsonb not null default '[]'::jsonb,
  tempo_data jsonb not null default '[]'::jsonb,
  volume_data jsonb not null default '[]'::jsonb,
  scores jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table public.sessions add column if not exists title text not null default 'Practice';
alter table public.sessions add column if not exists tanpura_key text;

create index if not exists sessions_user_id_started_at_idx
  on public.sessions (user_id, started_at desc);

create table if not exists public.session_metrics (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  pitch_accuracy numeric,
  tempo_stability numeric,
  volume_consistency numeric,
  extra jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint session_metrics_session_unique unique (session_id)
);

create table if not exists public.user_daily_engagement (
  user_id uuid not null references public.users (id) on delete cascade,
  day date not null,
  logged_in_at timestamptz,
  activity_completed_at timestamptz,
  primary key (user_id, day)
);

create index if not exists user_daily_engagement_user_day_desc_idx
  on public.user_daily_engagement (user_id, day desc);

-- ----- 2. Username + friends -----
create unique index if not exists users_username_lower_unique
  on public.users (lower(username))
  where username is not null;

alter table public.users drop constraint if exists users_username_format;
alter table public.users
  add constraint users_username_format check (
    username is null
    or (
      char_length(username) between 3 and 24
      and username ~ '^[a-z][a-z0-9_]{2,23}$'
    )
  );

create table if not exists public.user_friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  friend_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_friendships_no_self check (user_id <> friend_id),
  constraint user_friendships_unique unique (user_id, friend_id)
);

create index if not exists user_friendships_user_id_idx
  on public.user_friendships (user_id);

-- ----- 3. Row level security -----
alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.session_metrics enable row level security;
alter table public.user_daily_engagement enable row level security;
alter table public.user_friendships enable row level security;

drop policy if exists "Users can read own profile" on public.users;
create policy "Users can read own profile"
  on public.users for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
  on public.users for update using (auth.uid() = id);

drop policy if exists "Users read friends for leaderboard" on public.users;
create policy "Users read friends for leaderboard"
  on public.users for select
  using (
    auth.uid() = id
    or exists (
      select 1 from public.user_friendships f
      where f.user_id = auth.uid() and f.friend_id = users.id
    )
  );

drop policy if exists "Authenticated lookup users by username" on public.users;
create policy "Authenticated lookup users by username"
  on public.users for select
  to authenticated
  using (username is not null);

drop policy if exists "Sessions CRUD own" on public.sessions;
create policy "Sessions CRUD own"
  on public.sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Session metrics via own sessions" on public.session_metrics;
create policy "Session metrics via own sessions"
  on public.session_metrics for all
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_metrics.session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_metrics.session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Users read own engagement" on public.user_daily_engagement;
create policy "Users read own engagement"
  on public.user_daily_engagement for select using (auth.uid() = user_id);

drop policy if exists "Users insert own engagement" on public.user_daily_engagement;
create policy "Users insert own engagement"
  on public.user_daily_engagement for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own engagement" on public.user_daily_engagement;
create policy "Users update own engagement"
  on public.user_daily_engagement for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Friendships read own" on public.user_friendships;
create policy "Friendships read own"
  on public.user_friendships for select using (auth.uid() = user_id);

drop policy if exists "Friendships insert own" on public.user_friendships;
create policy "Friendships insert own"
  on public.user_friendships for insert with check (auth.uid() = user_id);

drop policy if exists "Friendships delete own" on public.user_friendships;
create policy "Friendships delete own"
  on public.user_friendships for delete using (auth.uid() = user_id);

-- ----- 4. Auth + social functions -----
create or replace function public.normalize_username(p_raw text)
returns text language sql immutable as $$
  select lower(trim(coalesce(p_raw, '')));
$$;

create or replace function public.is_username_available(p_username text)
returns boolean
language plpgsql security definer set search_path = public stable as $$
declare
  u text := public.normalize_username(p_username);
begin
  if u = '' or u !~ '^[a-z][a-z0-9_]{2,23}$' then return false; end if;
  return not exists (select 1 from public.users x where lower(x.username) = u);
end;
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.is_email_available(p_email text)
returns boolean
language plpgsql security definer set search_path = public stable as $$
declare
  em text := lower(trim(coalesce(p_email, '')));
begin
  if em = '' or position('@' in em) = 0 then return false; end if;
  return not exists (select 1 from auth.users au where lower(au.email) = em);
end;
$$;

grant execute on function public.is_email_available(text) to anon, authenticated;

create or replace function public.resolve_login_email(p_identifier text)
returns text
language plpgsql security definer set search_path = public stable as $$
declare
  v text := trim(coalesce(p_identifier, ''));
  em text;
begin
  if v = '' then return null; end if;
  if position('@' in v) > 0 then return lower(v); end if;
  select u.email into em from public.users u where lower(u.username) = lower(v) limit 1;
  return em;
end;
$$;

grant execute on function public.resolve_login_email(text) to anon, authenticated;

create or replace function public.lookup_user_by_username(p_username text)
returns table (id uuid, username text, first_name text)
language plpgsql security definer set search_path = public stable as $$
declare u text := public.normalize_username(p_username);
begin
  if u = '' or u !~ '^[a-z][a-z0-9_]{2,23}$' then return; end if;
  return query
  select usr.id, usr.username, usr.first_name
  from public.users usr where lower(usr.username) = u limit 1;
end;
$$;

grant execute on function public.lookup_user_by_username(text) to authenticated;

create or replace function public.get_friends_streak_leaderboard()
returns table (
  rank bigint, user_id uuid, username text, first_name text,
  login_streak_current integer, login_streak_best integer, is_self boolean
)
language sql security definer set search_path = public stable as $$
  with pool as (
    select
      u.id,
      u.username,
      u.first_name,
      coalesce(u.login_streak_current, 0) as login_streak_current,
      coalesce(u.login_streak_best, 0) as login_streak_best,
      true as is_self
    from public.users u
    where u.id = auth.uid()
    union all
    select
      u.id,
      u.username,
      u.first_name,
      coalesce(u.login_streak_current, 0),
      coalesce(u.login_streak_best, 0),
      false
    from public.user_friendships f
    join public.users u on u.id = f.friend_id
    where f.user_id = auth.uid()
  ),
  ranked as (
    select
      row_number() over (
        order by
          login_streak_current desc,
          login_streak_best desc,
          lower(coalesce(username, '')),
          id
      ) as rank,
      pool.*
    from pool
  )
  select
    ranked.rank,
    ranked.id,
    ranked.username,
    ranked.first_name,
    ranked.login_streak_current,
    ranked.login_streak_best,
    ranked.is_self
  from ranked
  order by ranked.rank;
$$;

grant execute on function public.get_friends_streak_leaderboard() to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare fn text; un text;
begin
  fn := nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), '');
  un := public.normalize_username(coalesce(new.raw_user_meta_data->>'username', ''));
  if un = '' then un := null;
  elsif un !~ '^[a-z][a-z0-9_]{2,23}$' then un := null;
  end if;
  insert into public.users (id, email, first_name, username)
  values (new.id, new.email, fn, un)
  on conflict (id) do update set
    email = excluded.email,
    first_name = coalesce(nullif(excluded.first_name, ''), public.users.first_name),
    username = coalesce(excluded.username, public.users.username);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.users (id, email, first_name, username)
select
  a.id,
  a.email,
  nullif(trim(coalesce(a.raw_user_meta_data->>'first_name', '')), ''),
  nullif(
    public.normalize_username(coalesce(a.raw_user_meta_data->>'username', '')),
    ''
  )
from auth.users a
left join public.users u on u.id = a.id
where u.id is null;

-- ----- 5. Quiz points (leaderboard + shop balance) -----
-- Scoring: correct +1 plus +1 per prior consecutive correct; wrong -1; no attempt-only points.
alter table public.users
  add column if not exists quiz_points_total integer not null default 0;

alter table public.users
  add column if not exists quiz_correct_streak integer not null default 0;

comment on column public.users.quiz_points_total is
  'Lifetime points from quizzes and sing-with-tāla bonus; spent in shop.';
comment on column public.users.quiz_correct_streak is
  'Consecutive correct quiz answers (streak bonus on next correct).';

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

-- ----- 6. Shop + daily practice -----
alter table public.users
  add column if not exists shop_streak_freeze_inventory integer not null default 0,
  add column if not exists shop_streak_freeze_armed boolean not null default false,
  add column if not exists shop_shruti_box_owned boolean not null default false,
  add column if not exists shop_profile_badge text,
  add column if not exists shop_points_multiplier_until timestamptz,
  add column if not exists shop_nickname_trophy text,
  add column if not exists shop_nickname_trophies_owned text[] not null default '{}',
  add column if not exists shop_streak_freeze_inventory_tiers jsonb not null default '{}'::jsonb,
  add column if not exists shop_streak_freeze_armed_days integer not null default 0;

comment on column public.users.shop_streak_freeze_inventory is
  'Legacy 1-day freeze count; migrated into shop_streak_freeze_inventory_tiers.';
comment on column public.users.shop_streak_freeze_armed is
  'Legacy armed flag; use shop_streak_freeze_armed_days.';
comment on column public.users.shop_shruti_box_owned is
  'Unlocks shruti box on the Shop page.';
comment on column public.users.shop_profile_badge is
  'Equipped profile badge id (null = none).';
comment on column public.users.shop_points_multiplier_until is
  'While in the future, quiz point awards are multiplied by 1.5×.';
comment on column public.users.shop_nickname_trophy is
  'Equipped nickname trophy id (leaderboard display).';
comment on column public.users.shop_nickname_trophies_owned is
  'Purchased nickname trophy ids.';
comment on column public.users.shop_streak_freeze_inventory_tiers is
  'Map of freeze length (days as string keys) to token count, e.g. {"1":2,"7":1}.';
comment on column public.users.shop_streak_freeze_armed_days is
  'When > 0, next login sync bridges up to this many consecutive missed days (then resets to 0).';

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

grant execute on function public.award_quiz_points(boolean) to authenticated;

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

drop function if exists public.purchase_shop_item(text, text);
drop function if exists public.purchase_shop_item(text, text, date);

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

grant execute on function public.purchase_shop_item(text, text, date) to authenticated;

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
    shop_streak_freeze_armed_days = p_days,
    shop_streak_freeze_armed = false
  where id = uid;

  return jsonb_build_object(
    'ok', true,
    'shop_streak_freeze_inventory_tiers', tiers,
    'shop_streak_freeze_armed_days', p_days
  );
end;
$$;

grant execute on function public.arm_streak_freeze(integer) to authenticated;

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

-- ----- 7. Sing with tāla practice bonus (+5 once per calendar day at 15 min singing) -----
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

-- ----- 8. Hold the swara (best hold times per shruti key) -----
create table if not exists public.user_hold_swara_bests (
  user_id uuid not null references public.users (id) on delete cascade,
  tanpura_key text not null,
  best_seconds double precision not null check (best_seconds > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, tanpura_key)
);

create index if not exists user_hold_swara_bests_user_id_idx
  on public.user_hold_swara_bests (user_id);

alter table public.user_hold_swara_bests enable row level security;

drop policy if exists "Users read own hold swara bests" on public.user_hold_swara_bests;
create policy "Users read own hold swara bests"
  on public.user_hold_swara_bests for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own hold swara bests" on public.user_hold_swara_bests;
create policy "Users insert own hold swara bests"
  on public.user_hold_swara_bests for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own hold swara bests" on public.user_hold_swara_bests;
create policy "Users update own hold swara bests"
  on public.user_hold_swara_bests for update
  using (auth.uid() = user_id);

create or replace function public.upsert_hold_swara_best(
  p_tanpura_key text,
  p_seconds double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  trimmed_key text;
  prev double precision;
  stored double precision;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  trimmed_key := nullif(trim(p_tanpura_key), '');
  if trimmed_key is null or p_seconds is null or p_seconds <= 0 then
    raise exception 'invalid hold swara payload';
  end if;

  select b.best_seconds
  into prev
  from public.user_hold_swara_bests b
  where b.user_id = uid and b.tanpura_key = trimmed_key
  for update;

  if not found then
    insert into public.user_hold_swara_bests (user_id, tanpura_key, best_seconds)
    values (uid, trimmed_key, p_seconds)
    returning best_seconds into stored;
  elsif p_seconds > prev then
    update public.user_hold_swara_bests
    set best_seconds = p_seconds, updated_at = now()
    where user_id = uid and tanpura_key = trimmed_key
    returning best_seconds into stored;
  else
    stored := prev;
  end if;

  return jsonb_build_object('best_seconds', stored, 'improved', p_seconds > coalesce(prev, 0));
end;
$$;

grant execute on function public.upsert_hold_swara_best(text, double precision) to authenticated;

-- ----- Done -----
notify pgrst, 'reload schema';
