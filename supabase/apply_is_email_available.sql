-- Run in Supabase → SQL Editor (same as migrations/011_is_email_available.sql).

create or replace function public.is_email_available(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  em text := lower(trim(coalesce(p_email, '')));
begin
  if em = '' or position('@' in em) = 0 then
    return false;
  end if;

  return not exists (
    select 1
    from auth.users au
    where lower(au.email) = em
  );
end;
$$;

grant execute on function public.is_email_available(text) to anon, authenticated;
