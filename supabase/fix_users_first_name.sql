-- Run in Supabase SQL if you already have public.users without first_name / old trigger.

alter table public.users
  add column if not exists first_name text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fn text;
begin
  fn := nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), '');
  insert into public.users (id, email, first_name)
  values (new.id, new.email, fn)
  on conflict (id) do update
    set email = excluded.email,
        first_name = coalesce(nullif(excluded.first_name, ''), public.users.first_name);
  return new;
end;
$$;

-- Optional: backfill from Auth user_metadata for existing users who have it set.
update public.users u
set first_name = nullif(trim(a.raw_user_meta_data->>'first_name'), '')
from auth.users a
where a.id = u.id
  and (u.first_name is null or u.first_name = '')
  and coalesce(trim(a.raw_user_meta_data->>'first_name'), '') <> '';
