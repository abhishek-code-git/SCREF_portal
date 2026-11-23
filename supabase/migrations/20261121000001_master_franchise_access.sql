-- Master Franchise access.
-- A master franchise owner is a `franchise_owner` membership whose scope is a master franchise
-- (memberships.master_franchise_id). Until now they could only READ their network. This adds,
-- strictly inside their own master franchise:
--   * request a new franchise (always created as 'pending', Central Admin approves it)
--   * request a new school under one of their ACTIVE franchises (always 'onboarding')
--   * give / remove franchise-owner access for a franchise and principal access for a school
--   * two read models for the Master Franchisee dashboard
-- They still cannot approve anything, change a status, or touch another master's data.

-- Helpers
create or replace function public.is_master_owner(_master_franchise_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.role = 'franchise_owner'
      and m.master_franchise_id = _master_franchise_id
  )
$$;

create or replace function public.is_master_owner_of_franchise(_franchise_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.franchises f
    join public.memberships m
      on m.master_franchise_id = f.master_franchise_id
     and m.user_id = auth.uid()
     and m.role = 'franchise_owner'
    where f.id = _franchise_id
  )
$$;

create or replace function public.is_master_owner_of_school(_school_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.schools s
    join public.franchises f on f.id = s.franchise_id
    join public.memberships m
      on m.master_franchise_id = f.master_franchise_id
     and m.user_id = auth.uid()
     and m.role = 'franchise_owner'
    where s.id = _school_id
  )
$$;

revoke all on function public.is_master_owner(uuid) from public;
revoke all on function public.is_master_owner_of_franchise(uuid) from public;
revoke all on function public.is_master_owner_of_school(uuid) from public;
grant execute on function public.is_master_owner(uuid) to authenticated;
grant execute on function public.is_master_owner_of_franchise(uuid) to authenticated;
grant execute on function public.is_master_owner_of_school(uuid) to authenticated;

-- Request a franchise (pending only, only while the master franchise is active)
drop policy if exists "master owners request franchises" on public.franchises;
create policy "master owners request franchises"
on public.franchises for insert to authenticated
with check (
  status = 'pending'
  and public.is_master_owner(master_franchise_id)
  and exists (
    select 1 from public.master_franchises mf
    where mf.id = master_franchise_id and mf.status = 'active'
  )
);

-- Request a school (onboarding only, under an ACTIVE franchise of an ACTIVE master)
drop policy if exists "master owners request schools" on public.schools;
create policy "master owners request schools"
on public.schools for insert to authenticated
with check (
  status = 'onboarding'
  and created_by = auth.uid()
  and franchise_id is not null
  and public.is_master_owner_of_franchise(franchise_id)
  and exists (
    select 1
    from public.franchises f
    join public.master_franchises mf on mf.id = f.master_franchise_id
    where f.id = franchise_id and f.status = 'active' and mf.status = 'active'
  )
);

-- People: franchise owners (franchise scope) and principals (school scope).
-- Cannot grant master-scope, central, teacher or any other role.
drop policy if exists "master owners manage network people" on public.memberships;
create policy "master owners manage network people"
on public.memberships for all to authenticated
using (
  (role = 'franchise_owner' and franchise_id is not null
     and public.is_master_owner_of_franchise(franchise_id))
  or
  (role = 'school_principal' and school_id is not null
     and public.is_master_owner_of_school(school_id))
)
with check (
  (role = 'franchise_owner' and franchise_id is not null
     and public.is_master_owner_of_franchise(franchise_id))
  or
  (role = 'school_principal' and school_id is not null
     and public.is_master_owner_of_school(school_id))
);

-- Read models
-- WHY security definer: a master/franchise owner has no school-level membership, so row-level
-- security (correctly) hides student, class and attendance ROWS from them. They only need
-- COUNTS. These functions return aggregates only, and each one checks access itself
-- (can_access_master_franchise: that master's owner, or Central Admin), so a caller who has no
-- access gets no rows at all. auth.uid() is still the real caller inside a definer function.

-- Read model 1: headline numbers for one master franchise
create or replace function public.master_franchise_overview(_master_franchise_id uuid)
returns table (
  territory_count bigint,
  franchise_count bigint,
  active_franchise_count bigint,
  pending_franchise_count bigint,
  school_count bigint,
  active_school_count bigint,
  pending_school_count bigint,
  student_count bigint,
  teacher_count bigint,
  principal_count bigint,
  attendance_today_count bigint,
  attendance_today_present bigint,
  franchises_without_owner bigint,
  schools_without_principal bigint
)
language sql stable security definer set search_path = public
as $$
  with fr as (
    select f.* from public.franchises f where f.master_franchise_id = _master_franchise_id
  ),
  sc as (
    select s.* from public.schools s join fr on fr.id = s.franchise_id
  )
  select
    (select count(*) from public.master_franchise_territories t where t.master_franchise_id = _master_franchise_id),
    (select count(*) from fr),
    (select count(*) from fr where status = 'active'),
    (select count(*) from fr where status = 'pending'),
    (select count(*) from sc),
    (select count(*) from sc where status = 'active'),
    (select count(*) from sc where status = 'onboarding'),
    (select count(*) from public.students st where st.school_id in (select id from sc)),
    (select count(distinct m.user_id) from public.memberships m where m.role = 'teacher' and m.school_id in (select id from sc)),
    (select count(distinct m.user_id) from public.memberships m where m.role = 'school_principal' and m.school_id in (select id from sc)),
    (select count(*) from public.attendance_records ar where ar.att_date = current_date and ar.school_id in (select id from sc)),
    (select count(*) from public.attendance_records ar where ar.att_date = current_date and ar.status = 'present' and ar.school_id in (select id from sc)),
    (select count(*) from fr where status = 'active' and not exists (
       select 1 from public.memberships m where m.role = 'franchise_owner' and m.franchise_id = fr.id)),
    (select count(*) from sc where status = 'active' and not exists (
       select 1 from public.memberships m where m.role = 'school_principal' and m.school_id = sc.id))
  where public.can_access_master_franchise(_master_franchise_id);
$$;

-- Read model 2: one row per franchise with its numbers
create or replace function public.master_franchise_franchise_stats(_master_franchise_id uuid)
returns table (
  franchise_id uuid,
  franchise_name text,
  franchise_status text,
  territory text,
  created_at timestamptz,
  school_count bigint,
  active_school_count bigint,
  student_count bigint,
  teacher_count bigint,
  owner_names text,
  attendance_today_count bigint,
  attendance_today_present bigint
)
language sql stable security definer set search_path = public
as $$
  select
    f.id,
    f.name,
    f.status,
    t.territory,
    f.created_at,
    (select count(*) from public.schools s where s.franchise_id = f.id),
    (select count(*) from public.schools s where s.franchise_id = f.id and s.status = 'active'),
    (select count(*) from public.students st join public.schools s on s.id = st.school_id where s.franchise_id = f.id),
    (select count(distinct m.user_id) from public.memberships m join public.schools s on s.id = m.school_id
       where s.franchise_id = f.id and m.role = 'teacher'),
    (select string_agg(distinct p.full_name, ', ' order by p.full_name)
       from public.memberships m join public.profiles p on p.user_id = m.user_id
       where m.role = 'franchise_owner' and m.franchise_id = f.id),
    (select count(*) from public.attendance_records ar join public.schools s on s.id = ar.school_id
       where s.franchise_id = f.id and ar.att_date = current_date),
    (select count(*) from public.attendance_records ar join public.schools s on s.id = ar.school_id
       where s.franchise_id = f.id and ar.att_date = current_date and ar.status = 'present')
  from public.franchises f
  left join public.master_franchise_territories t on t.id = f.territory_id
  where f.master_franchise_id = _master_franchise_id
    and public.can_access_master_franchise(_master_franchise_id)
  order by f.created_at desc, f.id;
$$;

revoke all on function public.master_franchise_overview(uuid) from public;
revoke all on function public.master_franchise_franchise_stats(uuid) from public;
grant execute on function public.master_franchise_overview(uuid) to authenticated;
grant execute on function public.master_franchise_franchise_stats(uuid) to authenticated;

-- Fix the existing franchise dashboard for network-scope owners.
-- franchise_network_dashboard() already filters its rows to the caller's network (central, school,
-- franchise or master scope) and returns only counts and school summary fields. As a security
-- INVOKER function a master/franchise owner saw 0 students, classes and attendance, because those
-- tables are readable only with a school-level membership. Running it as definer fixes that
-- without exposing any student row.
alter function public.franchise_network_dashboard(uuid, uuid) security definer;
