-- Central Admin hardening.
--   1. Only a Central Super Admin may create/change/remove Central Admin memberships.
--      Central Ops Admin keeps day-to-day access management for every other role.
--   2. The last Central Super Admin can never be removed or demoted (no lock-out).
--   3. A territory (e.g. a state) can belong to only one master franchise.
--   4. Schools created by Central Admin get an automatic CEN-#### code.
--   5. People invited by Central Admin no longer get a placeholder "My Centre" school.
--   6. Helper used by the invite API route to find an existing account by email.

-- 1. Super admin helper + membership policies
create or replace function public.has_super_admin_role()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and role = 'central_super_admin'
  )
$$;
revoke all on function public.has_super_admin_role() from public;
grant execute on function public.has_super_admin_role() to authenticated;

drop policy if exists "central admins manage memberships" on public.memberships;
drop policy if exists "super admins manage memberships" on public.memberships;
drop policy if exists "ops admins manage non-central memberships" on public.memberships;

create policy "super admins manage memberships"
on public.memberships for all to authenticated
using (public.has_super_admin_role())
with check (public.has_super_admin_role());

create policy "ops admins manage non-central memberships"
on public.memberships for all to authenticated
using (
  public.has_central_role()
  and role not in ('central_super_admin', 'central_ops_admin')
)
with check (
  public.has_central_role()
  and role not in ('central_super_admin', 'central_ops_admin')
);

-- 2. Never lose the last Central Super Admin
create or replace function public.protect_last_super_admin()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.role = 'central_super_admin'
     and (tg_op = 'DELETE' or new.role <> 'central_super_admin')
     and not exists (
       select 1 from public.memberships m
       where m.role = 'central_super_admin' and m.id <> old.id
     )
  then
    raise exception 'At least one Central Super Admin must remain. Add another Super Admin first.'
      using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;
revoke all on function public.protect_last_super_admin() from public;

drop trigger if exists protect_last_super_admin_trg on public.memberships;
create trigger protect_last_super_admin_trg
before update or delete on public.memberships
for each row execute function public.protect_last_super_admin();

-- 3. One owner per territory
create unique index if not exists master_franchise_territories_territory_unique_idx
  on public.master_franchise_territories (lower(btrim(territory)));

-- 4. Automatic school codes
-- The signed-in role needs USAGE on the sequence for the column default to work.
grant usage, select on sequence public.school_code_seq to authenticated;
alter table public.schools
  alter column code set default ('CEN-' || lpad(nextval('public.school_code_seq')::text, 4, '0'));

-- 5. No placeholder centre for people invited by Central Admin
-- The invite API route marks invited users with user_metadata.invited_by_admin = true.
create or replace function public.handle_new_user_centre()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  new_school_id uuid;
  inv record;
  found_invite boolean := false;
begin
  for inv in
    select *
    from public.staff_invites
    where lower(email) = lower(new.email)
      and accepted_at is null
  loop
    found_invite := true;
    insert into public.memberships (user_id, school_id, role)
    values (new.id, inv.school_id, inv.role)
    on conflict do nothing;

    if inv.class_id is not null and inv.role = 'teacher' then
      update public.classes
      set class_teacher = new.id
      where id = inv.class_id
        and class_teacher is null;
    end if;

    update public.staff_invites
    set accepted_at = now()
    where id = inv.id;
  end loop;

  if not found_invite
    and coalesce(new.raw_user_meta_data->>'invited_by_admin', '') <> 'true'
    and not exists (select 1 from public.memberships where user_id = new.id)
  then
    insert into public.schools (code, name, city, state, address, academic_year, status, created_by)
    values (
      'CEN-' || lpad(nextval('public.school_code_seq')::text, 4, '0'),
      coalesce(nullif(new.raw_user_meta_data->>'centre_name', ''), 'My Centre'),
      coalesce(new.raw_user_meta_data->>'city', ''),
      coalesce(new.raw_user_meta_data->>'state', ''),
      coalesce(new.raw_user_meta_data->>'address', ''),
      coalesce(nullif(new.raw_user_meta_data->>'academic_year', ''), '2026-27'),
      'onboarding',
      new.id
    )
    returning id into new_school_id;

    insert into public.memberships (user_id, school_id, role)
    values (new.id, new_school_id, 'franchise_owner');
  end if;

  return new;
end
$function$;

-- 6. Email lookup for the invite route (service role only)
create or replace function public.admin_find_user_by_email(_email text)
returns uuid
language sql stable security definer set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(btrim(_email)) limit 1
$$;
revoke all on function public.admin_find_user_by_email(text) from public;
revoke all on function public.admin_find_user_by_email(text) from anon, authenticated;
grant execute on function public.admin_find_user_by_email(text) to service_role;
