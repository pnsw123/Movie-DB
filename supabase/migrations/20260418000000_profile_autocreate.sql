-- Ensure a profiles row exists for every auth.users (backfill any stragglers).
insert into public.profiles (id, email, username, display_name)
select u.id,
       u.email,
       split_part(u.email, '@', 1),
       coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
  and u.email is not null;

-- Trigger: auto-create a profile row whenever a new auth user signs up
-- (via UI signup OR via auth.admin.createUser via the Admin API).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, email, username, display_name)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
