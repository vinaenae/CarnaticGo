-- Populate first_name from Google/OAuth metadata when email sign-up did not set it.

create or replace function public.first_name_from_auth_metadata(meta jsonb)
returns text
language sql
immutable
as $$
  select nullif(
    trim(
      coalesce(
        nullif(trim(meta->>'first_name'), ''),
        nullif(trim(meta->>'given_name'), ''),
        nullif(
          split_part(
            coalesce(
              nullif(trim(meta->>'full_name'), ''),
              nullif(trim(meta->>'name'), '')
            ),
            ' ',
            1
          ),
          ''
        )
      )
    ),
    ''
  );
$$;

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
  fn := public.first_name_from_auth_metadata(new.raw_user_meta_data);
  if fn is not null then
    fn := left(fn, 80);
  end if;

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

-- Backfill first names for existing Google/OAuth users missing a profile name.
update public.users u
set first_name = left(public.first_name_from_auth_metadata(a.raw_user_meta_data), 80)
from auth.users a
where a.id = u.id
  and (u.first_name is null or trim(u.first_name) = '')
  and public.first_name_from_auth_metadata(a.raw_user_meta_data) is not null;
