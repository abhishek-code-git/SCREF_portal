-- Keep application display profiles linked to existing Supabase Auth users.
-- Existing accounts are backfilled in place; no Auth users or memberships are recreated.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

drop policy if exists "users can view own profile" on public.profiles;
create policy "users can view own profile"
on public.profiles for select to authenticated
using (user_id = auth.uid());

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

insert into public.profiles (user_id, full_name, phone)
select
  u.id,
  nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
  coalesce(u.raw_user_meta_data->>'phone', '')
from auth.users u
on conflict (user_id) do nothing;

create or replace function public.handle_new_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, phone)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_auth_profile();
