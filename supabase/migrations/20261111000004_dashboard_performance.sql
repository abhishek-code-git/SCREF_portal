-- Dashboard indexes and a single-request central summary for larger datasets.
create index if not exists memberships_school_role_user_idx
  on public.memberships(school_id, role, user_id);
create index if not exists schools_status_created_idx
  on public.schools(status, created_at desc);
create index if not exists students_school_class_idx
  on public.students(school_id, class_id);
create index if not exists attendance_school_date_status_idx
  on public.attendance_records(school_id, att_date, status);

create or replace function public.central_network_dashboard()
returns table (
  school_count bigint,
  active_school_count bigint,
  pending_school_count bigint,
  student_count bigint,
  class_count bigint,
  principal_count bigint,
  teacher_count bigint,
  franchise_owner_count bigint
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
    (select count(distinct user_id) from public.memberships where role = 'franchise_owner')
  where public.has_central_role();
$$;

revoke all on function public.central_network_dashboard() from public;
grant execute on function public.central_network_dashboard() to authenticated;
