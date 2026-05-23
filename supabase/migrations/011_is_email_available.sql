-- Signup: reject emails already registered in auth.users.

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

comment on function public.is_email_available(text) is
  'True when no auth.users row uses this email (case-insensitive).';
