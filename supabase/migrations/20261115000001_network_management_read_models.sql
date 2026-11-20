-- Read-only dashboard scope for authenticated network owners and Central Admin.
-- Scope is always validated with the database membership helpers. No data is
-- assigned or backfilled by this migration.

-- Suspended or inactive network entities stop granting owner access. Central
-- admins retain access so they can review and reactivate records.
create or replace function public.can_access_master_franchise(_master_franchise_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_central_role() or exists (
    select 1 from public.master_franchises mf
    join public.memberships m on m.master_franchise_id = mf.id
    where mf.id = _master_franchise_id
      and lower(mf.status) not in ('suspended', 'inactive')
      and m.user_id = auth.uid() and m.role = 'franchise_owner'
  )
$$;

create or replace function public.can_access_franchise(_franchise_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_central_role() or exists (
    select 1
    from public.franchises f
    join public.master_franchises mf on mf.id = f.master_franchise_id
    left join public.memberships direct_member
      on direct_member.franchise_id = f.id
      and direct_member.user_id = auth.uid()
      and direct_member.role = 'franchise_owner'
    where f.id = _franchise_id
      and lower(f.status) not in ('suspended', 'inactive')
      and lower(mf.status) not in ('suspended', 'inactive')
      and (direct_member.id is not null or public.can_access_master_franchise(mf.id))
  )
$$;

revoke all on function public.can_access_master_franchise(uuid) from public;
revoke all on function public.can_access_franchise(uuid) from public;
grant execute on function public.can_access_master_franchise(uuid) to authenticated;
grant execute on function public.can_access_franchise(uuid) to authenticated;

drop function if exists public.franchise_network_dashboard();

create function public.franchise_network_dashboard(
  _master_franchise_id uuid default null,
  _franchise_id uuid default null
)
returns table (
  school_id uuid,
  school_code text,
  school_name text,
  city text,
  state text,
  address text,
  academic_year text,
  school_status text,
  school_created_at timestamptz,
  student_count bigint,
  teacher_count bigint,
  principal_count bigint,
  principal_names text,
  class_count bigint,
  attendance_today_count bigint,
  attendance_today_present bigint,
  network_teacher_count bigint,
  network_principal_count bigint
)
language sql stable security invoker set search_path = public
as $$
  with network_schools as (
    select s.*
    from public.schools s
    where
      (
        _master_franchise_id is null and _franchise_id is null
        and public.can_access_school_network(s.id)
      )
      or (
        _master_franchise_id is not null and _franchise_id is null
        and public.can_access_master_franchise(_master_franchise_id)
        and exists (
          select 1 from public.franchises f
          where f.master_franchise_id = _master_franchise_id and f.id = s.franchise_id
        )
      )
      or (
        _franchise_id is not null
        and public.can_access_franchise(_franchise_id)
        and s.franchise_id = _franchise_id
      )
      or (
        _master_franchise_id is null and _franchise_id is null
        and exists (
          select 1 from public.memberships assigned
          where assigned.user_id = auth.uid()
            and assigned.school_id = s.id and assigned.role = 'franchise_owner'
        )
      )
  )
  select
    s.id, s.code, s.name, s.city, s.state, s.address, s.academic_year,
    s.status, s.created_at,
    (select count(*) from public.students st where st.school_id = s.id),
    (select count(distinct m.user_id) from public.memberships m where m.school_id = s.id and m.role = 'teacher'),
    (select count(distinct m.user_id) from public.memberships m where m.school_id = s.id and m.role = 'school_principal'),
    (select string_agg(distinct p.full_name, ', ' order by p.full_name)
      from public.memberships m join public.profiles p on p.user_id = m.user_id
      where m.school_id = s.id and m.role = 'school_principal'),
    (select count(*) from public.classes c where c.school_id = s.id),
    (select count(*) from public.attendance_records ar where ar.school_id = s.id and ar.att_date = current_date),
    (select count(*) from public.attendance_records ar where ar.school_id = s.id and ar.att_date = current_date and ar.status = 'present'),
    (select count(distinct m.user_id) from public.memberships m
      where m.role = 'teacher' and exists (select 1 from network_schools ns where ns.id = m.school_id)),
    (select count(distinct m.user_id) from public.memberships m
      where m.role = 'school_principal' and exists (select 1 from network_schools ns where ns.id = m.school_id))
  from network_schools s
  order by s.created_at desc, s.id;
$$;

revoke all on function public.franchise_network_dashboard(uuid, uuid) from public;
grant execute on function public.franchise_network_dashboard(uuid, uuid) to authenticated;

drop function if exists public.central_network_dashboard();

create function public.central_network_dashboard()
returns table (
  school_count bigint,
  active_school_count bigint,
  pending_school_count bigint,
  student_count bigint,
  class_count bigint,
  principal_count bigint,
  teacher_count bigint,
  franchise_owner_count bigint,
  master_franchise_count bigint,
  franchise_count bigint
)
language sql stable security invoker set search_path = public
as $$
  select
    (select count(*) from public.schools),
    (select count(*) from public.schools where lower(status) = 'active'),
    (select count(*) from public.schools where lower(status) in ('pending','onboarding')),
    (select count(*) from public.students),
    (select count(*) from public.classes),
    (select count(distinct user_id) from public.memberships where role = 'school_principal'),
    (select count(distinct user_id) from public.memberships where role = 'teacher'),
    (select count(distinct user_id) from public.memberships where role = 'franchise_owner'),
    (select count(*) from public.master_franchises),
    (select count(*) from public.franchises)
  where public.has_central_role();
$$;

revoke all on function public.central_network_dashboard() from public;
grant execute on function public.central_network_dashboard() to authenticated;
