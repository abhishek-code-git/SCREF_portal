-- Franchisee (franchise-scope owner) and school staff access.
--
-- 1. A franchisee is a `franchise_owner` membership whose scope is a FRANCHISE
--    (memberships.franchise_id). From now on the database treats them as the owner of every
--    ACTIVE school in that franchise, the same way a school-level owner already works. Master
--    franchise owners are NOT affected: they keep seeing counts only.
-- 2. Franchisee may request schools under their own active franchise (status 'onboarding').
-- 3. Franchisee may give/remove principals and school staff in their schools.
--    Principals may give/remove school staff (teacher, admissions, accountant, transport) in their school.
-- 4. franchise_overview(): aggregate numbers for the Franchisee dashboard.

-- Helpers
create or replace function public.is_franchise_owner(_franchise_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.role = 'franchise_owner'
      and m.franchise_id = _franchise_id
  )
$$;

create or replace function public.is_franchise_owner_of_school(_school_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.schools s
    join public.franchises f on f.id = s.franchise_id
    join public.memberships m
      on m.franchise_id = f.id
     and m.user_id = auth.uid()
     and m.role = 'franchise_owner'
    where s.id = _school_id
      and f.status = 'active'
  )
$$;

-- True when the franchise AND its master franchise are both active. A franchisee cannot read their
-- master franchise's row, so this check must run with the function's own rights.
create or replace function public.franchise_is_open(_franchise_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.franchises f
    join public.master_franchises mf on mf.id = f.master_franchise_id
    where f.id = _franchise_id and f.status = 'active' and mf.status = 'active'
  )
$$;

revoke all on function public.is_franchise_owner(uuid) from public;
revoke all on function public.is_franchise_owner_of_school(uuid) from public;
revoke all on function public.franchise_is_open(uuid) from public;
grant execute on function public.is_franchise_owner(uuid) to authenticated;
grant execute on function public.is_franchise_owner_of_school(uuid) to authenticated;
grant execute on function public.franchise_is_open(uuid) to authenticated;

-- A franchisee counts as 'franchise_owner' of every school in their active franchise
create or replace function public.has_school_role(_school_id uuid, _roles public.app_role[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where school_id = _school_id and user_id = auth.uid() and role = any(_roles)
  )
  or (
    'franchise_owner'::public.app_role = any(_roles)
    and public.is_franchise_owner_of_school(_school_id)
  )
$$;

create or replace function public.is_school_member(_school_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where school_id = _school_id and user_id = _user_id
  )
  or (_user_id = auth.uid() and public.is_franchise_owner_of_school(_school_id))
$$;

-- Franchisee requests a school (onboarding only, under their own ACTIVE franchise)
drop policy if exists "franchise owners request schools" on public.schools;
create policy "franchise owners request schools"
on public.schools for insert to authenticated
with check (
  status = 'onboarding'
  and created_by = auth.uid()
  and franchise_id is not null
  and public.is_franchise_owner(franchise_id)
  and public.franchise_is_open(franchise_id)
);

-- Franchisee manages principals and school staff in their schools
drop policy if exists "franchise owners manage school people" on public.memberships;
create policy "franchise owners manage school people"
on public.memberships for all to authenticated
using (
  role in ('school_principal','teacher','admissions_staff','accountant','transport_manager')
  and school_id is not null
  and public.is_franchise_owner_of_school(school_id)
)
with check (
  role in ('school_principal','teacher','admissions_staff','accountant','transport_manager')
  and school_id is not null
  and public.is_franchise_owner_of_school(school_id)
);

-- Principal manages school staff (not other principals) in their own school
drop policy if exists "principals manage school staff" on public.memberships;
create policy "principals manage school staff"
on public.memberships for all to authenticated
using (
  role in ('teacher','admissions_staff','accountant','transport_manager')
  and school_id is not null
  and public.has_school_role(school_id, array['school_principal']::public.app_role[])
)
with check (
  role in ('teacher','admissions_staff','accountant','transport_manager')
  and school_id is not null
  and public.has_school_role(school_id, array['school_principal']::public.app_role[])
);

-- Read model: headline numbers for one franchise
-- security definer + explicit access check: a franchisee has no row-level access to every
-- table, but counts are safe. can_access_franchise = that franchise's owner, its master
-- franchise owner, or Central Admin. Anyone else gets no rows.
create or replace function public.franchise_overview(_franchise_id uuid)
returns table (
  school_count bigint,
  active_school_count bigint,
  pending_school_count bigint,
  student_count bigint,
  teacher_count bigint,
  principal_count bigint,
  attendance_today_count bigint,
  attendance_today_present bigint,
  schools_without_principal bigint
)
language sql stable security definer set search_path = public
as $$
  with sc as (select s.* from public.schools s where s.franchise_id = _franchise_id)
  select
    (select count(*) from sc),
    (select count(*) from sc where status = 'active'),
    (select count(*) from sc where status = 'onboarding'),
    (select count(*) from public.students st where st.school_id in (select id from sc)),
    (select count(distinct m.user_id) from public.memberships m where m.role = 'teacher' and m.school_id in (select id from sc)),
    (select count(distinct m.user_id) from public.memberships m where m.role = 'school_principal' and m.school_id in (select id from sc)),
    (select count(*) from public.attendance_records ar where ar.att_date = current_date and ar.school_id in (select id from sc)),
    (select count(*) from public.attendance_records ar where ar.att_date = current_date and ar.status = 'present' and ar.school_id in (select id from sc)),
    (select count(*) from sc where status = 'active' and not exists (
       select 1 from public.memberships m where m.role = 'school_principal' and m.school_id = sc.id))
  where public.can_access_franchise(_franchise_id);
$$;

revoke all on function public.franchise_overview(uuid) from public;
grant execute on function public.franchise_overview(uuid) to authenticated;
