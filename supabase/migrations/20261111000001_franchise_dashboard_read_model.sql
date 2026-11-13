-- Read-only dashboard aggregate for schools explicitly assigned through
-- franchise_owner memberships. The function runs as the caller so the existing
-- schools, students, classes, attendance, and memberships RLS policies remain
-- in force for every underlying read.
drop policy if exists "school leaders can view assigned member profiles" on public.profiles;
create policy "school leaders can view assigned member profiles"
on public.profiles for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.memberships member
    where member.user_id = profiles.user_id
      and public.can_view_school_members(member.school_id)
  )
);

create or replace function public.franchise_network_dashboard()
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
language sql
stable
security invoker
set search_path = public
as $$
  select
    s.id,
    s.code,
    s.name,
    s.city,
    s.state,
    s.address,
    s.academic_year,
    s.status,
    s.created_at,
    (select count(*) from public.students st where st.school_id = s.id),
    (select count(distinct m.user_id) from public.memberships m
      where m.school_id = s.id and m.role = 'teacher'),
    (select count(distinct m.user_id) from public.memberships m
      where m.school_id = s.id and m.role = 'school_principal'),
    (select string_agg(distinct p.full_name, ', ' order by p.full_name)
      from public.memberships m
      join public.profiles p on p.user_id = m.user_id
      where m.school_id = s.id and m.role = 'school_principal'),
    (select count(*) from public.classes c where c.school_id = s.id),
    (select count(*) from public.attendance_records ar
      where ar.school_id = s.id and ar.att_date = current_date),
    (select count(*) from public.attendance_records ar
      where ar.school_id = s.id and ar.att_date = current_date and ar.status = 'present'),
    (select count(distinct m.user_id) from public.memberships m
      where m.role = 'teacher'
        and exists (
          select 1 from public.memberships assigned
          where assigned.user_id = auth.uid()
            and assigned.school_id = m.school_id
            and assigned.role = 'franchise_owner'
        )),
    (select count(distinct m.user_id) from public.memberships m
      where m.role = 'school_principal'
        and exists (
          select 1 from public.memberships assigned
          where assigned.user_id = auth.uid()
            and assigned.school_id = m.school_id
            and assigned.role = 'franchise_owner'
        ))
  from public.schools s
  where exists (
    select 1
    from public.memberships assigned
    where assigned.user_id = auth.uid()
      and assigned.school_id = s.id
      and assigned.role = 'franchise_owner'
  )
  order by s.created_at desc, s.id;
$$;

revoke all on function public.franchise_network_dashboard() from public;
grant execute on function public.franchise_network_dashboard() to authenticated;
