-- Franchisee dashboard finalization:
-- 1. School request lifecycle (decline_reason, update/resubmit/cancel RPCs)
-- 2. Franchise profile contact columns & update_franchise_contact RPC
-- 3. Multi-franchise switcher RPC (my_franchises)
-- 4. Franchisee read-model RPCs (comparison, attendance, funnel, enrolment, activity, needs_attention, schools, team)
-- 5. Read-only / writable guards on franchisee membership management + audit coverage + indexes

-- ─── 1. Schema additions (real columns inspected first) ─────────────────────

alter table public.schools
  add column if not exists decline_reason text not null default '';

create sequence if not exists public.franchise_code_seq start 1;
grant usage, select on sequence public.franchise_code_seq to authenticated;

alter table public.franchises
  add column if not exists code text,
  add column if not exists phone text not null default '',
  add column if not exists email text not null default '',
  add column if not exists address text not null default '',
  add column if not exists city text not null default '',
  add column if not exists state text not null default '',
  add column if not exists owner_name text not null default '';

alter table public.franchises
  alter column code set default ('FRN-' || lpad(nextval('public.franchise_code_seq')::text, 4, '0'));

update public.franchises
set code = 'FRN-' || lpad(nextval('public.franchise_code_seq')::text, 4, '0')
where code is null or btrim(code) = '';

create unique index if not exists franchises_code_unique_idx
  on public.franchises(code) where code is not null;

-- ─── 2. Franchise Dashboard Read Helper & Writable Guard ────────────────────

create or replace function public.can_read_franchise_dashboard(_franchise_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_central_role() or exists (
    select 1
    from public.franchises f
    join public.memberships m
      on m.user_id = auth.uid()
     and m.role = 'franchise_owner'
    where f.id = _franchise_id
      and (m.franchise_id = f.id or m.master_franchise_id = f.master_franchise_id)
  );
$$;

revoke all on function public.can_read_franchise_dashboard(uuid) from public;
grant execute on function public.can_read_franchise_dashboard(uuid) to authenticated;

-- Enforce school_is_writable on franchisee school-people writes (reads remain allowed)
drop policy if exists "franchise owners manage school people" on public.memberships;
create policy "franchise owners select school people"
on public.memberships for select to authenticated
using (
  role in ('school_principal','teacher','admissions_staff','accountant','transport_manager')
  and school_id is not null
  and public.is_franchise_owner_of_school(school_id)
);
create policy "franchise owners insert school people"
on public.memberships for insert to authenticated
with check (
  role in ('school_principal','teacher','admissions_staff','accountant','transport_manager')
  and school_id is not null
  and public.is_franchise_owner_of_school(school_id)
  and public.school_is_writable(school_id)
);
create policy "franchise owners update school people"
on public.memberships for update to authenticated
using (
  role in ('school_principal','teacher','admissions_staff','accountant','transport_manager')
  and school_id is not null
  and public.is_franchise_owner_of_school(school_id)
  and public.school_is_writable(school_id)
)
with check (
  role in ('school_principal','teacher','admissions_staff','accountant','transport_manager')
  and school_id is not null
  and public.is_franchise_owner_of_school(school_id)
  and public.school_is_writable(school_id)
);
create policy "franchise owners delete school people"
on public.memberships for delete to authenticated
using (
  role in ('school_principal','teacher','admissions_staff','accountant','transport_manager')
  and school_id is not null
  and public.is_franchise_owner_of_school(school_id)
  and public.school_is_writable(school_id)
);

-- ─── 3. Audit Trigger Coverage for Franchisee & School Lifecycle ─────────────

create or replace function public.audit_central_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row jsonb := '{}'::jsonb;
  new_row jsonb := '{}'::jsonb;
  row_id uuid;
  v_franchise_id text;
begin
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if not public.has_central_role() and tg_table_name not in ('schools', 'memberships', 'franchises') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op <> 'INSERT' then old_row := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then new_row := to_jsonb(new); end if;
  row_id := nullif(coalesce(new_row->>'id', new_row->>'user_id', old_row->>'id', old_row->>'user_id'), '')::uuid;

  v_franchise_id := coalesce(new_row->>'franchise_id', old_row->>'franchise_id');
  if v_franchise_id is null and coalesce(new_row->>'school_id', old_row->>'school_id') is not null then
    select s.franchise_id::text into v_franchise_id
    from public.schools s
    where s.id = coalesce(new_row->>'school_id', old_row->>'school_id')::uuid;
  end if;

  insert into public.central_admin_audit_logs(actor_user_id, action, entity_table, entity_id, details)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    row_id,
    jsonb_strip_nulls(jsonb_build_object(
      'name', coalesce(new_row->>'name', old_row->>'name'),
      'status', coalesce(new_row->>'status', old_row->>'status'),
      'previous_status', case when tg_op = 'UPDATE' then old_row->>'status' end,
      'decline_reason', nullif(coalesce(new_row->>'decline_reason', old_row->>'decline_reason'), ''),
      'role', coalesce(new_row->>'role', old_row->>'role'),
      'previous_role', case when tg_op = 'UPDATE' then old_row->>'role' end,
      'target_user_id', coalesce(new_row->>'user_id', old_row->>'user_id'),
      'school_id', coalesce(new_row->>'school_id', old_row->>'school_id'),
      'previous_school_id', case when tg_op = 'UPDATE' then old_row->>'school_id' end,
      'master_franchise_id', coalesce(new_row->>'master_franchise_id', old_row->>'master_franchise_id'),
      'previous_master_franchise_id', case when tg_op = 'UPDATE' then old_row->>'master_franchise_id' end,
      'franchise_id', v_franchise_id,
      'previous_franchise_id', case when tg_op = 'UPDATE' then old_row->>'franchise_id' end,
      'setting_key', coalesce(new_row->>'setting_key', old_row->>'setting_key'),
      'territory', coalesce(new_row->>'territory', old_row->>'territory')
    ))
  );
  if tg_op = 'DELETE' then return old; else return new; end if;
end
$$;
revoke all on function public.audit_central_admin_change() from public;

-- ─── 4. School Request Lifecycle RPCs ───────────────────────────────────────

create or replace function public.update_school_request(
  _school_id uuid,
  _name text,
  _city text,
  _state text,
  _address text,
  _academic_year text
)
returns public.schools
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school public.schools;
  v_updated public.schools;
begin
  select * into v_school from public.schools where id = _school_id;
  if not found then
    raise exception 'School request not found' using errcode = 'P0002';
  end if;

  if v_school.franchise_id is null or not public.is_franchise_owner(v_school.franchise_id) then
    raise exception 'Forbidden: only this franchise owner may edit this school request' using errcode = '42501';
  end if;

  if not public.franchise_is_open(v_school.franchise_id) then
    raise exception 'Franchise workspace is read-only (suspended or inactive)' using errcode = '42501';
  end if;

  if v_school.status <> 'onboarding' then
    raise exception 'Only pending onboarding requests can be edited directly' using errcode = '22023';
  end if;

  if coalesce(nullif(btrim(_name), ''), '') = '' then
    raise exception 'School name is required' using errcode = '22023';
  end if;

  update public.schools
  set
    name = btrim(_name),
    city = coalesce(btrim(_city), city),
    state = coalesce(btrim(_state), state),
    address = coalesce(btrim(_address), address),
    academic_year = coalesce(nullif(btrim(_academic_year), ''), academic_year)
  where id = _school_id
  returning * into v_updated;

  insert into public.central_admin_audit_logs (actor_user_id, action, entity_table, entity_id, details)
  values (
    auth.uid(),
    'update_school_request',
    'schools',
    _school_id,
    jsonb_build_object(
      'school_id', _school_id,
      'franchise_id', v_updated.franchise_id,
      'name', v_updated.name
    )
  );

  return v_updated;
end;
$$;

create or replace function public.resubmit_school_request(
  _school_id uuid,
  _name text,
  _city text,
  _state text,
  _address text,
  _academic_year text
)
returns public.schools
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school public.schools;
  v_updated public.schools;
begin
  select * into v_school from public.schools where id = _school_id;
  if not found then
    raise exception 'School request not found' using errcode = 'P0002';
  end if;

  if v_school.franchise_id is null or not public.is_franchise_owner(v_school.franchise_id) then
    raise exception 'Forbidden: only this franchise owner may resubmit this school request' using errcode = '42501';
  end if;

  if not public.franchise_is_open(v_school.franchise_id) then
    raise exception 'Franchise workspace is read-only (suspended or inactive)' using errcode = '42501';
  end if;

  if v_school.status <> 'rejected' then
    raise exception 'Only declined school requests can be resubmitted' using errcode = '22023';
  end if;

  if coalesce(nullif(btrim(_name), ''), '') = '' then
    raise exception 'School name is required' using errcode = '22023';
  end if;

  update public.schools
  set
    name = btrim(_name),
    city = coalesce(btrim(_city), city),
    state = coalesce(btrim(_state), state),
    address = coalesce(btrim(_address), address),
    academic_year = coalesce(nullif(btrim(_academic_year), ''), academic_year),
    status = 'onboarding',
    decline_reason = ''
  where id = _school_id
  returning * into v_updated;

  insert into public.central_admin_audit_logs (actor_user_id, action, entity_table, entity_id, details)
  values (
    auth.uid(),
    'resubmit_school_request',
    'schools',
    _school_id,
    jsonb_build_object(
      'school_id', _school_id,
      'franchise_id', v_updated.franchise_id,
      'name', v_updated.name
    )
  );

  return v_updated;
end;
$$;

create or replace function public.cancel_school_request(_school_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school public.schools;
begin
  select * into v_school from public.schools where id = _school_id;
  if not found then
    raise exception 'School request not found' using errcode = 'P0002';
  end if;

  if v_school.franchise_id is null or not public.is_franchise_owner(v_school.franchise_id) then
    raise exception 'Forbidden: only this franchise owner may cancel this school request' using errcode = '42501';
  end if;

  if not public.franchise_is_open(v_school.franchise_id) then
    raise exception 'Franchise workspace is read-only (suspended or inactive)' using errcode = '42501';
  end if;

  if v_school.status <> 'onboarding' then
    raise exception 'Only pending onboarding requests can be cancelled' using errcode = '22023';
  end if;

  if exists (select 1 from public.classes c where c.school_id = _school_id)
     or exists (select 1 from public.students s where s.school_id = _school_id)
     or exists (
       select 1 from public.memberships m
       where m.school_id = _school_id
         and m.user_id <> coalesce(v_school.created_by, auth.uid())
     ) then
    raise exception 'Cannot cancel a school that already has classes, students, or staff memberships' using errcode = '22023';
  end if;

  insert into public.central_admin_audit_logs (actor_user_id, action, entity_table, entity_id, details)
  values (
    auth.uid(),
    'cancel_school_request',
    'schools',
    _school_id,
    jsonb_build_object(
      'school_id', _school_id,
      'franchise_id', v_school.franchise_id,
      'name', v_school.name
    )
  );

  delete from public.schools where id = _school_id;
  return true;
end;
$$;

revoke all on function public.update_school_request(uuid, text, text, text, text, text) from public;
revoke all on function public.resubmit_school_request(uuid, text, text, text, text, text) from public;
revoke all on function public.cancel_school_request(uuid) from public;
grant execute on function public.update_school_request(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.resubmit_school_request(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.cancel_school_request(uuid) to authenticated;

-- ─── 5. Franchise Profile Contact RPC ───────────────────────────────────────

create or replace function public.update_franchise_contact(
  _franchise_id uuid,
  _phone text default null,
  _email text default null,
  _address text default null,
  _city text default null,
  _state text default null,
  _owner_name text default null
)
returns public.franchises
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.franchises;
begin
  if not public.is_franchise_owner(_franchise_id) then
    raise exception 'Forbidden: only the assigned franchise owner may update contact details' using errcode = '42501';
  end if;

  if not public.franchise_is_open(_franchise_id) then
    raise exception 'Franchise workspace is read-only (suspended or inactive)' using errcode = '42501';
  end if;

  update public.franchises
  set
    phone = coalesce(btrim(_phone), phone),
    email = coalesce(btrim(_email), email),
    address = coalesce(btrim(_address), address),
    city = coalesce(btrim(_city), city),
    state = coalesce(btrim(_state), state),
    owner_name = coalesce(btrim(_owner_name), owner_name)
  where id = _franchise_id
  returning * into v_row;

  if not found then
    raise exception 'Franchise not found' using errcode = 'P0002';
  end if;

  insert into public.central_admin_audit_logs (actor_user_id, action, entity_table, entity_id, details)
  values (
    auth.uid(),
    'update_franchise_contact',
    'franchises',
    _franchise_id,
    jsonb_strip_nulls(jsonb_build_object(
      'franchise_id', _franchise_id,
      'name', v_row.name,
      'city', nullif(v_row.city, ''),
      'state', nullif(v_row.state, '')
    ))
  );

  return v_row;
end;
$$;

revoke all on function public.update_franchise_contact(uuid, text, text, text, text, text, text) from public;
grant execute on function public.update_franchise_contact(uuid, text, text, text, text, text, text) to authenticated;

-- ─── 6. Multi-Franchise & Read-Model RPCs ───────────────────────────────────

create or replace function public.my_franchises()
returns table (
  id uuid,
  name text,
  code text,
  status text,
  master_name text,
  master_status text,
  territory text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  owner_name text
)
language sql stable security definer set search_path = public
as $$
  select
    f.id,
    f.name,
    f.code,
    f.status,
    mf.name as master_name,
    mf.status as master_status,
    t.territory,
    f.phone,
    f.email,
    f.address,
    f.city,
    f.state,
    f.owner_name
  from public.memberships m
  join public.franchises f on f.id = m.franchise_id
  join public.master_franchises mf on mf.id = f.master_franchise_id
  left join public.master_franchise_territories t on t.id = f.territory_id
  where m.user_id = auth.uid()
    and m.role = 'franchise_owner'
    and m.franchise_id is not null
  order by f.name, f.created_at;
$$;

-- Allow suspended franchisees to keep reading their overview in read-only state
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
    (select count(*) from public.students st where st.status = 'active' and st.school_id in (select id from sc)),
    (select count(distinct m.user_id) from public.memberships m where m.role = 'teacher' and m.school_id in (select id from sc)),
    (select count(distinct m.user_id) from public.memberships m where m.role = 'school_principal' and m.school_id in (select id from sc)),
    (select count(*) from public.attendance_records ar where ar.att_date = current_date and ar.school_id in (select id from sc)),
    (select count(*) from public.attendance_records ar where ar.att_date = current_date and ar.status = 'present' and ar.school_id in (select id from sc)),
    (select count(*) from sc where status = 'active' and not exists (
       select 1 from public.memberships m where m.role = 'school_principal' and m.school_id = sc.id))
  where public.can_read_franchise_dashboard(_franchise_id);
$$;

create or replace function public.franchise_schools_list(_franchise_id uuid)
returns table (
  school_id uuid,
  code text,
  name text,
  city text,
  state text,
  address text,
  academic_year text,
  status text,
  decline_reason text,
  created_at timestamptz,
  phone text,
  email text,
  principal_name text
)
language sql stable security definer set search_path = public
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
    s.decline_reason,
    s.created_at,
    s.phone,
    s.email,
    s.principal_name
  from public.schools s
  where s.franchise_id = _franchise_id
    and public.can_read_franchise_dashboard(_franchise_id)
  order by s.created_at desc, s.name;
$$;

create or replace function public.franchise_school_comparison(_franchise_id uuid)
returns table (
  school_id uuid,
  name text,
  code text,
  status text,
  student_count bigint,
  teacher_count bigint,
  has_principal boolean,
  attendance_pct_30d numeric,
  classes_without_attendance_today bigint,
  open_enquiries bigint,
  admitted_30d bigint,
  last_activity_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select
    s.id as school_id,
    s.name,
    s.code,
    s.status,
    (select count(*) from public.students st where st.school_id = s.id and st.status = 'active') as student_count,
    (select count(distinct m.user_id) from public.memberships m where m.school_id = s.id and m.role = 'teacher') as teacher_count,
    exists (select 1 from public.memberships m where m.school_id = s.id and m.role = 'school_principal') as has_principal,
    (
      select case
        when count(ar.id) = 0 then null
        else round((count(*) filter (where ar.status in ('present', 'late'))::numeric * 100.0) / count(ar.id)::numeric, 1)
      end
      from public.attendance_records ar
      where ar.school_id = s.id
        and ar.att_date >= current_date - 30
    ) as attendance_pct_30d,
    (
      select count(*) from public.classes c
      where c.school_id = s.id
        and not exists (
          select 1 from public.attendance_records ar
          where ar.class_id = c.id and ar.att_date = current_date
        )
    ) as classes_without_attendance_today,
    (
      select count(*) from public.admission_enquiries ae
      where ae.school_id = s.id and ae.stage not in ('enrolled', 'lost')
    ) as open_enquiries,
    (
      select count(*) from public.students st
      where st.school_id = s.id and st.status = 'active' and st.admitted_on >= current_date - 30
    ) as admitted_30d,
    greatest(
      s.created_at,
      (select max(ar.created_at) from public.attendance_records ar where ar.school_id = s.id),
      (select max(st.created_at) from public.students st where st.school_id = s.id),
      (select max(ae.updated_at) from public.admission_enquiries ae where ae.school_id = s.id)
    ) as last_activity_at
  from public.schools s
  where s.franchise_id = _franchise_id
    and public.can_read_franchise_dashboard(_franchise_id)
  order by s.name, s.code;
$$;

create or replace function public.franchise_attendance_report(
  _franchise_id uuid,
  _from date,
  _to date
)
returns table (
  school_id uuid,
  school_name text,
  att_date date,
  marked bigint,
  present bigint,
  absent bigint,
  late bigint,
  leave bigint
)
language sql stable security definer set search_path = public
as $$
  select
    s.id as school_id,
    s.name as school_name,
    ar.att_date,
    count(*) as marked,
    count(*) filter (where ar.status = 'present') as present,
    count(*) filter (where ar.status = 'absent') as absent,
    count(*) filter (where ar.status = 'late') as late,
    count(*) filter (where ar.status = 'leave') as leave
  from public.attendance_records ar
  join public.schools s on s.id = ar.school_id
  where s.franchise_id = _franchise_id
    and ar.att_date between _from and _to
    and public.can_read_franchise_dashboard(_franchise_id)
  group by s.id, s.name, ar.att_date
  order by ar.att_date desc, s.name;
$$;

create or replace function public.franchise_admissions_funnel(
  _franchise_id uuid,
  _from date,
  _to date
)
returns table (
  school_id uuid,
  school_name text,
  new_count bigint,
  contacted_count bigint,
  visited_count bigint,
  applied_count bigint,
  admitted_count bigint,
  lost_count bigint,
  total_count bigint,
  conversion_pct numeric
)
language sql stable security definer set search_path = public
as $$
  with counts as (
    select
      s.id as school_id,
      s.name as school_name,
      count(ae.id) filter (where ae.stage = 'new') as new_count,
      count(ae.id) filter (where ae.stage = 'contacted') as contacted_count,
      count(ae.id) filter (where ae.stage = 'visit_scheduled') as visited_count,
      count(ae.id) filter (where ae.stage = 'applied') as applied_count,
      count(ae.id) filter (where ae.stage = 'enrolled') as admitted_count,
      count(ae.id) filter (where ae.stage = 'lost') as lost_count,
      count(ae.id) as total_count
    from public.schools s
    left join public.admission_enquiries ae
      on ae.school_id = s.id
      and ae.created_at::date between _from and _to
    where s.franchise_id = _franchise_id
      and public.can_read_franchise_dashboard(_franchise_id)
    group by s.id, s.name
  )
  select
    school_id,
    school_name,
    new_count,
    contacted_count,
    visited_count,
    applied_count,
    admitted_count,
    lost_count,
    total_count,
    case
      when total_count = 0 then 0::numeric
      else round((admitted_count::numeric * 100.0) / total_count::numeric, 1)
    end as conversion_pct
  from counts
  order by school_name;
$$;

create or replace function public.franchise_enrolment_report(_franchise_id uuid)
returns table (
  school_id uuid,
  school_name text,
  class_id uuid,
  class_name text,
  section text,
  total_count bigint,
  boys_count bigint,
  girls_count bigint,
  other_count bigint
)
language sql stable security definer set search_path = public
as $$
  select
    s.id as school_id,
    s.name as school_name,
    c.id as class_id,
    c.name as class_name,
    c.section,
    count(st.id) as total_count,
    count(st.id) filter (where st.gender = 'male') as boys_count,
    count(st.id) filter (where st.gender = 'female') as girls_count,
    count(st.id) filter (where st.gender is null or st.gender = 'other') as other_count
  from public.schools s
  join public.classes c on c.school_id = s.id
  left join public.students st
    on st.class_id = c.id
    and st.school_id = s.id
    and st.status = 'active'
  where s.franchise_id = _franchise_id
    and public.can_read_franchise_dashboard(_franchise_id)
  group by s.id, s.name, c.id, c.name, c.section
  order by s.name, c.name, c.section;
$$;

create or replace function public.franchise_activity_feed(
  _franchise_id uuid,
  _limit int default 30
)
returns table (
  id uuid,
  actor_name text,
  what text,
  occurred_at timestamptz,
  school_name text
)
language sql stable security definer set search_path = public
as $$
  with target_schools as (
    select s.id, s.name
    from public.schools s
    where s.franchise_id = _franchise_id
  )
  select
    l.id,
    coalesce(nullif(btrim(p.full_name), ''), 'System') as actor_name,
    case
      when l.action = 'update_school_request' then 'Updated school request'
      when l.action = 'resubmit_school_request' then 'Resubmitted declined school request'
      when l.action = 'cancel_school_request' then 'Cancelled school request'
      when l.action = 'update_franchise_contact' then 'Updated franchise contact details'
      when l.entity_table = 'schools' and l.action = 'insert' then 'Requested new school'
      when l.entity_table = 'schools' and l.action = 'update' and l.details->>'status' = 'active' and l.details->>'previous_status' = 'onboarding' then 'School request approved'
      when l.entity_table = 'schools' and l.action = 'update' and l.details->>'status' = 'rejected' then 'School request declined'
      when l.entity_table = 'schools' and l.action = 'update' and l.details->>'status' = 'suspended' then 'School suspended'
      when l.entity_table = 'schools' and l.action = 'update' and l.details->>'status' = 'active' then 'School activated'
      when l.entity_table = 'memberships' and l.action = 'insert' and l.details->>'role' = 'school_principal' then 'Principal added'
      when l.entity_table = 'memberships' and l.action = 'delete' and l.details->>'role' = 'school_principal' then 'Principal removed'
      when l.entity_table = 'memberships' and l.action = 'insert' then 'Staff member assigned'
      when l.entity_table = 'memberships' and l.action = 'delete' then 'Staff access removed'
      when l.action = 'update_school_profile' then 'Updated school profile'
      when l.action = 'promote_students' then 'Promoted students'
      when l.action = 'issue_tc' then 'Issued transfer certificate'
      else initcap(replace(l.action || ' ' || l.entity_table, '_', ' '))
    end as what,
    l.created_at as occurred_at,
    coalesce(ts.name, l.details->>'name', 'Franchise') as school_name
  from public.central_admin_audit_logs l
  left join public.profiles p on p.user_id = l.actor_user_id
  left join target_schools ts
    on ts.id = coalesce(
      nullif(l.details->>'school_id', '')::uuid,
      case when l.entity_table = 'schools' then l.entity_id else null end
    )
  where public.can_read_franchise_dashboard(_franchise_id)
    and (
      l.details->>'franchise_id' = _franchise_id::text
      or (l.entity_table = 'franchises' and l.entity_id = _franchise_id)
      or ts.id is not null
    )
  order by l.created_at desc
  limit greatest(1, least(coalesce(_limit, 30), 100));
$$;

create or replace function public.franchise_needs_attention(_franchise_id uuid)
returns table (
  kind text,
  school_id uuid,
  school_name text,
  detail text,
  since timestamptz
)
language sql stable security definer set search_path = public
as $$
  with sc as (
    select s.* from public.schools s where s.franchise_id = _franchise_id
  )
  -- 1. Pending approval
  select
    'school_pending_approval'::text as kind,
    s.id as school_id,
    s.name as school_name,
    'Waiting for Central Admin onboarding approval'::text as detail,
    s.created_at as since
  from sc s
  where s.status = 'onboarding'
    and public.can_read_franchise_dashboard(_franchise_id)

  union all

  -- 2. Declined school requests
  select
    'school_declined'::text,
    s.id,
    s.name,
    case
      when nullif(btrim(s.decline_reason), '') is not null then 'Declined: ' || s.decline_reason
      else 'Request declined — edit and resubmit'
    end,
    s.created_at
  from sc s
  where s.status = 'rejected'
    and public.can_read_franchise_dashboard(_franchise_id)

  union all

  -- 3. Active schools without a principal
  select
    'school_without_principal'::text,
    s.id,
    s.name,
    'Active school has no assigned principal'::text,
    s.created_at
  from sc s
  where s.status = 'active'
    and not exists (
      select 1 from public.memberships m
      where m.school_id = s.id and m.role = 'school_principal'
    )
    and public.can_read_franchise_dashboard(_franchise_id)

  union all

  -- 4. Active schools with students but no attendance in the last 3 days
  select
    'school_no_attendance_3_days'::text,
    s.id,
    s.name,
    'No attendance recorded in the last 3 days'::text,
    coalesce(
      (select max(ar.created_at) from public.attendance_records ar where ar.school_id = s.id),
      s.created_at
    )
  from sc s
  where s.status = 'active'
    and exists (select 1 from public.students st where st.school_id = s.id and st.status = 'active')
    and not exists (
      select 1 from public.attendance_records ar
      where ar.school_id = s.id and ar.att_date >= current_date - 2
    )
    and public.can_read_franchise_dashboard(_franchise_id)

  union all

  -- 5. Active schools with zero students
  select
    'school_no_students'::text,
    s.id,
    s.name,
    'Active school has no enrolled active students yet'::text,
    s.created_at
  from sc s
  where s.status = 'active'
    and not exists (select 1 from public.students st where st.school_id = s.id and st.status = 'active')
    and public.can_read_franchise_dashboard(_franchise_id)

  order by since desc, school_name;
$$;

create or replace function public.franchise_team_directory(_franchise_id uuid)
returns table (
  kind text,
  record_id uuid,
  user_id uuid,
  school_id uuid,
  school_name text,
  role public.app_role,
  full_name text,
  phone text,
  email text,
  status text,
  created_at timestamptz
)
language sql stable security definer set search_path = public, auth
as $$
  select
    'member'::text as kind,
    m.id as record_id,
    m.user_id,
    s.id as school_id,
    s.name as school_name,
    m.role,
    coalesce(nullif(btrim(p.full_name), ''), 'Name not set') as full_name,
    coalesce(p.phone, '') as phone,
    coalesce(u.email::text, '') as email,
    'active'::text as status,
    m.created_at
  from public.schools s
  join public.memberships m on m.school_id = s.id
  left join public.profiles p on p.user_id = m.user_id
  left join auth.users u on u.id = m.user_id
  where s.franchise_id = _franchise_id
    and m.role in ('school_principal', 'teacher', 'admissions_staff', 'accountant', 'transport_manager')
    and public.can_read_franchise_dashboard(_franchise_id)

  union all

  select
    'invite'::text as kind,
    si.id as record_id,
    null::uuid as user_id,
    s.id as school_id,
    s.name as school_name,
    si.role,
    split_part(si.email, '@', 1) as full_name,
    ''::text as phone,
    si.email,
    'invited-pending'::text as status,
    si.created_at
  from public.schools s
  join public.staff_invites si on si.school_id = s.id
  where s.franchise_id = _franchise_id
    and si.accepted_at is null
    and public.can_read_franchise_dashboard(_franchise_id)

  order by status, school_name, role, full_name;
$$;

revoke all on function public.my_franchises() from public;
revoke all on function public.franchise_overview(uuid) from public;
revoke all on function public.franchise_schools_list(uuid) from public;
revoke all on function public.franchise_school_comparison(uuid) from public;
revoke all on function public.franchise_attendance_report(uuid, date, date) from public;
revoke all on function public.franchise_admissions_funnel(uuid, date, date) from public;
revoke all on function public.franchise_enrolment_report(uuid) from public;
revoke all on function public.franchise_activity_feed(uuid, int) from public;
revoke all on function public.franchise_needs_attention(uuid) from public;
revoke all on function public.franchise_team_directory(uuid) from public;

grant execute on function public.my_franchises() to authenticated;
grant execute on function public.franchise_overview(uuid) to authenticated;
grant execute on function public.franchise_schools_list(uuid) to authenticated;
grant execute on function public.franchise_school_comparison(uuid) to authenticated;
grant execute on function public.franchise_attendance_report(uuid, date, date) to authenticated;
grant execute on function public.franchise_admissions_funnel(uuid, date, date) to authenticated;
grant execute on function public.franchise_enrolment_report(uuid) to authenticated;
grant execute on function public.franchise_activity_feed(uuid, int) to authenticated;
grant execute on function public.franchise_needs_attention(uuid) to authenticated;
grant execute on function public.franchise_team_directory(uuid) to authenticated;

-- ─── 7. Report & Lookup Indexes ─────────────────────────────────────────────

create index if not exists attendance_school_date_idx on public.attendance_records(school_id, att_date);
create index if not exists schools_franchise_idx on public.schools(franchise_id);
create index if not exists memberships_franchise_idx on public.memberships(franchise_id) where franchise_id is not null;
create index if not exists memberships_school_role_idx on public.memberships(school_id, role) where school_id is not null;

-- Franchise owners can also read brand support contact info for /franchise/settings
drop policy if exists "franchise owners read brand support settings" on public.network_settings;
create policy "franchise owners read brand support settings"
on public.network_settings for select to authenticated
using (
  setting_key in ('network_name', 'support_email', 'support_phone')
  and exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.role = 'franchise_owner'
      and m.franchise_id is not null
  )
);
