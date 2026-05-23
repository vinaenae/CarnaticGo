-- Usernames (unique) and friend graph for streak leaderboard.

alter table public.users
  add column if not exists username text;

create unique index if not exists users_username_lower_unique
  on public.users (lower(username))
  where username is not null;

alter table public.users
  drop constraint if exists users_username_format;

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

alter table public.user_friendships enable row level security;

drop policy if exists "Friendships read own" on public.user_friendships;
create policy "Friendships read own"
  on public.user_friendships for select
  using (auth.uid() = user_id);

drop policy if exists "Friendships insert own" on public.user_friendships;
create policy "Friendships insert own"
  on public.user_friendships for insert
  with check (auth.uid() = user_id);

drop policy if exists "Friendships delete own" on public.user_friendships;
create policy "Friendships delete own"
  on public.user_friendships for delete
  using (auth.uid() = user_id);

-- Allow reading friend streak fields (not email) for leaderboard.
drop policy if exists "Users read friends for leaderboard" on public.users;
create policy "Users read friends for leaderboard"
  on public.users for select
  using (
    auth.uid() = id
    or exists (
      select 1
      from public.user_friendships f
      where f.user_id = auth.uid()
        and f.friend_id = users.id
    )
  );

create or replace function public.normalize_username(p_raw text)
returns text
language sql
immutable
as $$
  select lower(trim(coalesce(p_raw, '')));
$$;

create or replace function public.is_username_available(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  u text := public.normalize_username(p_username);
begin
  if u = '' or u !~ '^[a-z][a-z0-9_]{2,23}$' then
    return false;
  end if;
  return not exists (
    select 1 from public.users x where lower(x.username) = u
  );
end;
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.resolve_login_email(p_identifier text)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v text := trim(coalesce(p_identifier, ''));
  em text;
begin
  if v = '' then
    return null;
  end if;
  if position('@' in v) > 0 then
    return lower(v);
  end if;
  select u.email into em
  from public.users u
  where lower(u.username) = lower(v)
  limit 1;
  return em;
end;
$$;

grant execute on function public.resolve_login_email(text) to anon, authenticated;

create or replace function public.lookup_user_by_username(p_username text)
returns table (
  id uuid,
  username text,
  first_name text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  u text := public.normalize_username(p_username);
begin
  if u = '' or u !~ '^[a-z][a-z0-9_]{2,23}$' then
    return;
  end if;
  return query
  select usr.id, usr.username, usr.first_name
  from public.users usr
  where lower(usr.username) = u
  limit 1;
end;
$$;

grant execute on function public.lookup_user_by_username(text) to authenticated;

create or replace function public.get_friends_streak_leaderboard()
returns table (
  rank bigint,
  user_id uuid,
  username text,
  first_name text,
  login_streak_current integer,
  login_streak_best integer,
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
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fn text;
  un text;
begin
  fn := nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), '');
  un := public.normalize_username(coalesce(new.raw_user_meta_data->>'username', ''));
  if un = '' then
    un := null;
  elsif un !~ '^[a-z][a-z0-9_]{2,23}$' then
    un := null;
  end if;

  insert into public.users (id, email, first_name, username)
  values (new.id, new.email, fn, un)
  on conflict (id) do update
    set email = excluded.email,
        first_name = coalesce(nullif(excluded.first_name, ''), public.users.first_name),
        username = coalesce(excluded.username, public.users.username);
  return new;
end;
$$;
